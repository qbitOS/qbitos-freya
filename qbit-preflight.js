// beyondBINARY quantum-prefixed | uvspeed | {n, +1, -n, +0, 0, -1, +n, +2, -0, +3, 1}
// qbit-preflight.js — Pre-submission validation pipeline for CPU/GPU/QPU/Quantum
// 3% or less failure rate target across all ecosystem submissions
// A miscalibrated file on quantum = $500 in 5 seconds. Every check matters.
(function(root){
'use strict';

// ━━━━━ Backend Registry ━━━━━
// ISA-native gate sets per backend family — calibrated from real hardware data
var BACKEND_GATES = {
    'ibm_torino':    {qubits:133, gates:['sx','rz','cz','x','id','reset','delay','measure'], family:'heron', gen:'r1', maxDepth:300, t1Avg:172.5, t2Avg:134.7, t1Med:171.8, errAvg:2.46e-3, czAvg:6.0e-3, czMed:2.46e-3, readoutAvg:0.0626, readoutMed:0.0491, costPerShot:0.146, calibDate:'2026-02-19T14:44:14Z', gateLen:32, operational:133},
    'ibm_marrakesh': {qubits:156, gates:['sx','rz','cz','x','id','reset','delay','measure'], family:'heron', gen:'r2', maxDepth:300, t1Avg:190.2, t2Avg:121.8, t1Med:181.5, errAvg:2.43e-3, czAvg:4.81e-3, czMed:2.43e-3, readoutAvg:0.0302, readoutMed:0.0104, costPerShot:0.146, calibDate:'2026-02-21T03:01:19Z', gateLen:36, operational:156},
    'ibm_fez':       {qubits:156, gates:['sx','rz','cz','x','id','reset','delay','measure'], family:'heron', gen:'r2', maxDepth:300, t1Avg:151.0, t2Avg:105.7, t1Med:149.6, errAvg:4.19e-3, czAvg:4.19e-3, czMed:2.59e-3, readoutAvg:0.0287, readoutMed:0.0138, costPerShot:0.146, calibDate:'2026-02-21T08:40:17Z', gateLen:24, operational:156},
    'ibm_brussels':  {qubits:127, gates:['sx','rz','ecr','x','id','reset','delay','measure'], family:'eagle', gen:'r3', maxDepth:250, t1Avg:160, t2Avg:120, t1Med:155, errAvg:7.8e-3, czAvg:7.8e-3, czMed:5.0e-3, readoutAvg:0.035, readoutMed:0.015, costPerShot:0.146, calibDate:null, gateLen:36, operational:127},
    'ibm_strasbourg':{qubits:127, gates:['sx','rz','ecr','x','id','reset','delay','measure'], family:'eagle', gen:'r3', maxDepth:250, t1Avg:155, t2Avg:115, t1Med:150, errAvg:8.2e-3, czAvg:8.2e-3, czMed:5.5e-3, readoutAvg:0.038, readoutMed:0.018, costPerShot:0.146, calibDate:null, gateLen:36, operational:127},
    'ibm_kawasaki':  {qubits:127, gates:['sx','rz','ecr','x','id','reset','delay','measure'], family:'eagle', gen:'r3', maxDepth:250, t1Avg:150, t2Avg:110, t1Med:145, errAvg:8.5e-3, czAvg:8.5e-3, czMed:6.0e-3, readoutAvg:0.040, readoutMed:0.020, costPerShot:0.146, calibDate:null, gateLen:36, operational:127},
    'cpu_simulator': {qubits:32,  gates:['h','x','y','z','s','t','sx','rz','cz','ecr','cx','ccx','swap','measure'], family:'simulator', gen:'local', maxDepth:Infinity, t1Avg:Infinity, t2Avg:Infinity, t1Med:Infinity, errAvg:0, czAvg:0, czMed:0, readoutAvg:0, readoutMed:0, costPerShot:0, calibDate:'always', gateLen:0, operational:32},
    'gpu_simulator': {qubits:40,  gates:['h','x','y','z','s','t','sx','rz','cz','ecr','cx','ccx','swap','measure'], family:'simulator', gen:'wgsl', maxDepth:Infinity, t1Avg:Infinity, t2Avg:Infinity, t1Med:Infinity, errAvg:0, czAvg:0, czMed:0, readoutAvg:0, readoutMed:0, costPerShot:0, calibDate:'always', gateLen:0, operational:40},
    'wasm_simulator':{qubits:28,  gates:['h','x','y','z','s','t','sx','rz','cz','ecr','cx','ccx','swap','measure'], family:'simulator', gen:'wasm', maxDepth:Infinity, t1Avg:Infinity, t2Avg:Infinity, t1Med:Infinity, errAvg:0, czAvg:0, czMed:0, readoutAvg:0, readoutMed:0, costPerShot:0, calibDate:'always', gateLen:0, operational:28}
};

// ━━━━━ Calibration Store ━━━━━
var calibrationCache = {};
var CALIB_MAX_AGE_MS = 3600000;

// ━━━━━ Submission Ledger (failure rate tracking) ━━━━━
var ledger = {total:0, pass:0, fail:0, aborted:0, costSaved:0, history:[]};

function loadLedger(){
    try {
        var stored = (typeof localStorage !== 'undefined') ? localStorage.getItem('qbit-preflight-ledger') : null;
        if(stored) ledger = JSON.parse(stored);
    } catch(e){}
}
function saveLedger(){
    try { if(typeof localStorage !== 'undefined') localStorage.setItem('qbit-preflight-ledger', JSON.stringify(ledger)); } catch(e){}
}
loadLedger();

// ━━━━━ QASM Parser (lightweight, pre-flight only) ━━━━━
function parseQASMPreflight(src){
    if(!src || typeof src !== 'string') return {valid:false, error:'Empty or non-string input', qubits:0, gates:[], gateCount:{}, depth:0};
    var lines = src.split('\n');
    var qubits = 0, classicalBits = 0, gates = [], gateCount = {}, errors = [];
    var hasOpenQASM = false, hasInclude = false;

    lines.forEach(function(raw, lineNum){
        var line = raw.replace(/\/\/.*$/,'').trim();
        if(!line) return;
        if(line.match(/^OPENQASM\s/)) { hasOpenQASM = true; return; }
        if(line.match(/^include\s/)) { hasInclude = true; return; }

        var m;
        if((m = line.match(/^qreg\s+\w+\[(\d+)\]/))) { qubits = Math.max(qubits, +m[1]); return; }
        if((m = line.match(/^creg\s+\w+\[(\d+)\]/))) { classicalBits = Math.max(classicalBits, +m[1]); return; }

        var stmts = line.split(';').map(function(s){return s.trim();}).filter(Boolean);
        stmts.forEach(function(stmt){
            var gm;
            if((gm = stmt.match(/^(\w+)(\([^)]*\))?\s+/))) {
                var gateName = gm[1].toLowerCase();
                if(['openqasm','include','qreg','creg','barrier','if'].indexOf(gateName) >= 0) return;
                var targets = stmt.replace(gm[0], '').split(',').map(function(t){ return t.trim(); });
                var qubitsUsed = [];
                targets.forEach(function(t){
                    var qm = t.match(/\w+\[(\d+)\]/);
                    if(qm) qubitsUsed.push(+qm[1]);
                });
                gates.push({gate: gateName, line: lineNum+1, qubits: qubitsUsed, raw: stmt});
                gateCount[gateName] = (gateCount[gateName]||0) + 1;
            }
        });
    });

    if(!hasOpenQASM) errors.push({level:'warn', msg:'Missing OPENQASM declaration', line:1});
    if(qubits === 0) errors.push({level:'error', msg:'No qreg declaration found — qubit count unknown', line:0});

    // Estimate depth (simplified: max qubit used across sequential non-parallel ops)
    var qubitTime = {};
    var maxDepth = 0;
    gates.forEach(function(g){
        var maxT = 0;
        g.qubits.forEach(function(q){ maxT = Math.max(maxT, qubitTime[q]||0); });
        var nextT = maxT + 1;
        g.qubits.forEach(function(q){ qubitTime[q] = nextT; });
        maxDepth = Math.max(maxDepth, nextT);
    });

    return {
        valid: errors.filter(function(e){return e.level==='error';}).length === 0,
        qubits: qubits,
        classicalBits: classicalBits,
        gates: gates,
        gateCount: gateCount,
        gateTotal: gates.length,
        depth: maxDepth,
        errors: errors,
        hasOpenQASM: hasOpenQASM,
        hasInclude: hasInclude,
        lines: lines.length
    };
}

// ━━━━━ Core Preflight Checks ━━━━━
function preflight(qasm, backendName, opts){
    opts = opts || {};
    var shots = opts.shots || 4096;
    var maxCost = opts.maxCost || 1000;
    var strictISA = opts.strictISA !== false;
    var calMaxAge = opts.calMaxAge || CALIB_MAX_AGE_MS;

    var backend = BACKEND_GATES[backendName];
    if(!backend) return result('FAIL', 'Unknown backend: ' + backendName, []);

    var parsed = parseQASMPreflight(qasm);
    var checks = [];
    var totalScore = 0;
    var maxScore = 0;

    function check(name, pass, severity, detail, costIfFail){
        var weight = severity === 'critical' ? 30 : severity === 'high' ? 20 : severity === 'medium' ? 10 : 5;
        maxScore += weight;
        if(pass) totalScore += weight;
        checks.push({
            name: name,
            pass: pass,
            severity: severity,
            detail: detail,
            weight: weight,
            costIfFail: costIfFail || 0
        });
    }

    // ━━━ CHECK 1: QASM Syntax Valid ━━━
    check('QASM Syntax',
        parsed.valid,
        'critical',
        parsed.valid ? 'Valid QASM with ' + parsed.gateTotal + ' gates' : 'Parse errors: ' + parsed.errors.map(function(e){return e.msg;}).join('; '),
        maxCost
    );

    // ━━━ CHECK 2: Qubit Capacity ━━━
    var qubitsFit = parsed.qubits <= backend.qubits;
    check('Qubit Capacity',
        qubitsFit,
        'critical',
        qubitsFit ? parsed.qubits + '/' + backend.qubits + ' qubits used (' + ((parsed.qubits/backend.qubits)*100).toFixed(0) + '%)' : 'Circuit needs ' + parsed.qubits + 'q but ' + backendName + ' has ' + backend.qubits + 'q',
        backend.costPerShot * shots
    );

    // ━━━ CHECK 3: ISA Gate Compliance ━━━
    // Standard QASM gates that have known ISA decompositions (transpilable)
    var TRANSPILABLE = {
        'h':['sx','rz'], 'cx':['cz','sx','rz'], 'cnot':['cz','sx','rz'],
        'cy':['cz','sx','rz','s'], 'swap':['cz','sx','rz'],
        'ccx':['cz','sx','rz'], 'cswap':['cz','sx','rz'],
        'sdg':['rz'], 'tdg':['rz'], 'u1':['rz'], 'u2':['sx','rz'], 'u3':['sx','rz'],
        'rx':['sx','rz'], 'ry':['sx','rz'], 'p':['rz'],
        'z':['rz'], 'y':['sx','rz','x'], 's':['rz'], 't':['rz']
    };
    var foreignGates = [], transpilableGates = [];
    Object.keys(parsed.gateCount).forEach(function(g){
        if(backend.gates.indexOf(g) < 0) {
            if(TRANSPILABLE[g]) transpilableGates.push(g + '×' + parsed.gateCount[g]);
            else foreignGates.push(g + '×' + parsed.gateCount[g]);
        }
    });
    var isaClean = foreignGates.length === 0;
    var allTranspilable = isaClean && transpilableGates.length >= 0;
    var isaDetail;
    if(foreignGates.length === 0 && transpilableGates.length === 0) {
        isaDetail = 'All ' + parsed.gateTotal + ' gates are ISA-native for ' + backend.family;
    } else if(foreignGates.length === 0) {
        isaDetail = parsed.gateTotal + ' gates OK — ' + transpilableGates.join(', ') + ' auto-transpilable to ' + backend.family + ' ISA';
    } else {
        isaDetail = 'Unknown gates: ' + foreignGates.join(', ') + (transpilableGates.length ? ' (transpilable: ' + transpilableGates.join(', ') + ')' : '');
    }
    check('ISA Gate Compliance',
        allTranspilable || !strictISA,
        foreignGates.length > 0 ? 'critical' : 'low',
        isaDetail,
        foreignGates.length > 0 ? backend.costPerShot * shots : 0
    );

    // ━━━ CHECK 4: Circuit Depth vs Decoherence ━━━
    var depthRatio = parsed.depth / backend.maxDepth;
    var depthOk = depthRatio <= 1.0;
    var depthWarn = depthRatio > 0.7;
    check('Circuit Depth',
        depthOk,
        depthWarn ? 'high' : 'medium',
        'Depth ' + parsed.depth + '/' + backend.maxDepth + ' (' + (depthRatio*100).toFixed(0) + '%) — ' + (depthOk ? (depthWarn ? 'approaching decoherence limit' : 'within budget') : 'EXCEEDS decoherence window'),
        depthOk ? 0 : backend.costPerShot * shots * 0.8
    );

    // ━━━ CHECK 5: Estimated Fidelity ━━━
    var twoQubitGates = (parsed.gateCount['cz']||0) + (parsed.gateCount['ecr']||0) + (parsed.gateCount['cx']||0);
    var estimatedFidelity = Math.pow(1 - backend.errAvg, twoQubitGates);
    var fidelityPct = estimatedFidelity * 100;
    var fidelityOk = fidelityPct > 1;
    check('Estimated Fidelity',
        fidelityOk,
        fidelityPct < 5 ? 'high' : 'medium',
        fidelityPct.toFixed(2) + '% estimated from ' + twoQubitGates + ' two-qubit gates × ' + backend.errAvg.toExponential(1) + ' error rate' + (fidelityPct < 10 ? ' — expect noisy results' : ''),
        fidelityOk ? 0 : backend.costPerShot * shots
    );

    // ━━━ CHECK 6: Calibration Freshness ━━━
    var cal = calibrationCache[backendName];
    var calFresh = false;
    var calDetail = '';
    if(backend.family === 'simulator'){
        calFresh = true;
        calDetail = 'Simulator — no calibration needed';
    } else if(cal && cal.timestamp){
        var age = Date.now() - cal.timestamp;
        calFresh = age < calMaxAge;
        var ageMin = Math.floor(age / 60000);
        calDetail = calFresh ? 'Calibration data ' + ageMin + 'min old (limit: ' + (calMaxAge/60000) + 'min)' : 'STALE calibration: ' + ageMin + 'min old — refresh before submission';
    } else if(backend.calibDate && backend.calibDate !== null){
        var embeddedAge = Date.now() - new Date(backend.calibDate).getTime();
        var embeddedDays = Math.floor(embeddedAge / 86400000);
        calFresh = embeddedDays < 14;
        calDetail = calFresh
            ? 'Using embedded calibration from ' + backend.calibDate.split('T')[0] + ' (' + embeddedDays + 'd ago)'
            : 'Embedded calibration is ' + embeddedDays + 'd old — refresh from IBM Quantum for best results';
    } else {
        calDetail = 'No calibration data for ' + backendName + ' — fetch from IBM Quantum first';
    }
    check('Calibration Freshness',
        calFresh,
        calFresh ? 'low' : (backend.family === 'simulator' ? 'low' : 'medium'),
        calDetail,
        calFresh ? 0 : backend.costPerShot * shots * 0.2
    );

    // ━━━ CHECK 7: Cost Guard ━━━
    var estimatedCost = backend.costPerShot * shots;
    var costOk = estimatedCost <= maxCost;
    check('Cost Guard',
        costOk,
        estimatedCost > 500 ? 'critical' : 'medium',
        'Estimated cost: ' + estimatedCost.toFixed(0) + ' units for ' + shots + ' shots' + (costOk ? '' : ' — EXCEEDS budget of ' + maxCost + ' units'),
        costOk ? 0 : estimatedCost
    );

    // ━━━ CHECK 8: Measurement Coverage ━━━
    var measCount = parsed.gateCount['measure'] || 0;
    var measOk = measCount > 0 && measCount <= parsed.qubits;
    check('Measurement Coverage',
        measOk,
        'medium',
        measCount === 0 ? 'No measurement gates — results will be empty' : measCount + '/' + parsed.qubits + ' qubits measured (' + ((measCount/Math.max(parsed.qubits,1))*100).toFixed(0) + '%)',
        measOk ? 0 : estimatedCost
    );

    // ━━━ CHECK 9: Qubit Index Bounds ━━━
    var maxQubitIdx = 0;
    parsed.gates.forEach(function(g){ g.qubits.forEach(function(q){ maxQubitIdx = Math.max(maxQubitIdx, q); }); });
    var boundsOk = maxQubitIdx < backend.qubits;
    check('Qubit Index Bounds',
        boundsOk,
        'critical',
        boundsOk ? 'Max qubit index q[' + maxQubitIdx + '] within ' + backend.qubits + '-qubit device' : 'q[' + maxQubitIdx + '] exceeds device limit of ' + backend.qubits + ' qubits — will crash',
        boundsOk ? 0 : estimatedCost
    );

    // ━━━ CHECK 10: Shot Count Sanity ━━━
    var shotsOk = shots >= 100 && shots <= 100000;
    check('Shot Count',
        shotsOk,
        'low',
        shots + ' shots — ' + (shots < 100 ? 'too few for statistical significance' : shots > 100000 ? 'excessive, consider reducing' : 'good range'),
        0
    );

    // ━━━ VERDICT ━━━
    var criticalFails = checks.filter(function(c){ return !c.pass && c.severity === 'critical'; });
    var highFails = checks.filter(function(c){ return !c.pass && c.severity === 'high'; });
    var totalFailCost = 0;
    checks.forEach(function(c){ if(!c.pass) totalFailCost += c.costIfFail; });

    var verdict = criticalFails.length > 0 ? 'ABORT' : highFails.length > 0 ? 'WARN' : 'GO';
    var failureRate = ledger.total > 0 ? (ledger.fail / ledger.total * 100) : 0;

    var report = {
        verdict: verdict,
        backend: backendName,
        backendInfo: backend,
        backendFamily: backend.family || 'unknown',
        backendQubits: backend.qubits,
        parsed: parsed,
        checks: checks,
        score: totalScore,
        maxScore: maxScore,
        scorePct: maxScore > 0 ? (totalScore/maxScore*100).toFixed(1) : '0',
        passCount: checks.filter(function(c){return c.pass}).length,
        failCount: checks.filter(function(c){return !c.pass}).length,
        criticalFails: criticalFails.length,
        highFails: highFails.length,
        qubitCount: parsed.qubits,
        gateCount: parsed.gateTotal,
        gateBreakdown: parsed.gateCount,
        circuitDepth: parsed.depth,
        twoQubitGates: twoQubitGates,
        measureCount: measCount,
        estimatedCost: estimatedCost,
        estimatedFidelity: fidelityPct,
        potentialWaste: totalFailCost,
        shots: shots,
        failureRate: failureRate.toFixed(1),
        ledger: {total: ledger.total, pass: ledger.pass, fail: ledger.fail, costSaved: ledger.costSaved},
        timestamp: Date.now()
    };

    return report;
}

// ━━━━━ Record Submission Outcome ━━━━━
function recordOutcome(report, outcome){
    ledger.total++;
    if(outcome === 'pass') ledger.pass++;
    else if(outcome === 'fail') ledger.fail++;
    else if(outcome === 'aborted'){
        ledger.aborted++;
        ledger.costSaved += report.estimatedCost;
    }
    ledger.history.push({
        backend: report.backend,
        verdict: report.verdict,
        outcome: outcome,
        cost: report.estimatedCost,
        score: report.scorePct,
        time: Date.now()
    });
    if(ledger.history.length > 200) ledger.history = ledger.history.slice(-100);
    saveLedger();
    return ledger;
}

// ━━━━━ Calibration Management ━━━━━
function updateCalibration(backendName, data){
    calibrationCache[backendName] = {
        timestamp: Date.now(),
        t1: data.t1 || null,
        t2: data.t2 || null,
        gateError: data.gateError || null,
        readoutError: data.readoutError || null,
        raw: data
    };
    try { if(typeof localStorage !== 'undefined') localStorage.setItem('qbit-cal-' + backendName, JSON.stringify(calibrationCache[backendName])); } catch(e){}
}

function loadCalibration(backendName){
    try {
        var stored = (typeof localStorage !== 'undefined') ? localStorage.getItem('qbit-cal-' + backendName) : null;
        if(stored) calibrationCache[backendName] = JSON.parse(stored);
    } catch(e){}
    return calibrationCache[backendName] || null;
}

// ━━━━━ Report Formatters ━━━━━
function formatReportText(report){
    var lines = [];
    var bar = '═══════════════════════════════════════════════════';
    lines.push(bar);
    lines.push('  PREFLIGHT ' + report.verdict + ' — ' + report.backend);
    lines.push(bar);
    lines.push('');
    lines.push('  ┌─ CIRCUIT ──────────────────────────────────┐');
    lines.push('  │  Qubits:   ' + pad(report.qubitCount + '/' + report.backendQubits, 10) + 'Gates:  ' + pad(String(report.gateCount), 10) + '│');
    lines.push('  │  Depth:    ' + pad(String(report.circuitDepth), 10) + '2Q:     ' + pad(String(report.twoQubitGates), 10) + '│');
    lines.push('  │  Measure:  ' + pad(String(report.measureCount), 10) + 'Shots:  ' + pad(String(report.shots), 10) + '│');
    lines.push('  └────────────────────────────────────────────┘');
    lines.push('');
    lines.push('  ┌─ METRICS ─────────────────────────────────┐');
    lines.push('  │  Score:    ' + pad(report.scorePct + '% (' + report.score + '/' + report.maxScore + ')', 34) + '│');
    lines.push('  │  Fidelity: ' + pad('~' + report.estimatedFidelity.toFixed(2) + '%', 34) + '│');
    lines.push('  │  Cost:     ' + pad('~' + report.estimatedCost.toFixed(0) + ' units (' + report.shots + ' shots)', 34) + '│');
    lines.push('  │  Family:   ' + pad(report.backendFamily || '—', 34) + '│');
    lines.push('  └────────────────────────────────────────────┘');
    lines.push('');
    lines.push('  ┌─ CHECKS (' + report.passCount + '/' + (report.passCount + report.failCount) + ' pass) ─────────────────────┐');
    report.checks.forEach(function(c){
        var icon = c.pass ? '✓' : '✗';
        var sev = c.severity === 'critical' ? '!!!' : c.severity === 'high' ? '!! ' : c.severity === 'medium' ? '!  ' : '   ';
        lines.push('  │  ' + icon + ' ' + sev + pad(c.name, 16) + ' ' + trunc(c.detail, 22) + ' │');
        if(!c.pass && c.costIfFail > 0) lines.push('  │       ↳ waste risk: ' + pad(c.costIfFail.toFixed(0) + ' units', 23) + '│');
    });
    lines.push('  └────────────────────────────────────────────┘');
    lines.push('');
    if(report.verdict === 'ABORT'){
        lines.push('  ⛔ SUBMISSION BLOCKED — ' + report.criticalFails + ' critical failure(s)');
        lines.push('  Potential waste prevented: ' + report.potentialWaste.toFixed(0) + ' units');
    } else if(report.verdict === 'WARN'){
        lines.push('  ⚠ PROCEED WITH CAUTION — ' + report.highFails + ' high-severity warning(s)');
    } else {
        lines.push('  ✓ ALL CLEAR — safe to submit');
    }
    lines.push('');
    lines.push('  ┌─ ECOSYSTEM ────────────────────────────────┐');
    lines.push('  │  Submissions: ' + pad(String(report.ledger.total), 8) + 'Pass: ' + pad(String(report.ledger.pass), 8) + 'Fail: ' + pad(String(report.ledger.fail), 5) + '│');
    lines.push('  │  Failure rate: ' + pad(report.failureRate + '%', 8) + 'Cost saved: ' + pad(report.ledger.costSaved.toFixed(0) + ' units', 14) + '│');
    lines.push('  └────────────────────────────────────────────┘');
    lines.push(bar);
    return lines.join('\n');
}
function pad(s, w){ s = String(s); while(s.length < w) s += ' '; return s; }
function trunc(s, w){ s = String(s); return s.length <= w ? pad(s, w) : s.slice(0, w-1) + '…'; }

function formatReportHTML(report){
    var vc = report.verdict === 'GO' ? '#3fb950' : report.verdict === 'WARN' ? '#d29922' : '#f85149';
    var m = '#8b949e', w = '#c9d1d9', g = '#3fb950', a = '#c9a84c';
    var h = '<div style="font-family:monospace;font-size:12px;line-height:1.7;padding:8px 0">';
    h += '<div style="color:'+vc+';font-weight:700;font-size:15px;border-bottom:1px solid '+vc+'33;padding-bottom:4px;margin-bottom:6px">PREFLIGHT '+report.verdict+' — '+report.backend+'</div>';
    h += '<table style="border-collapse:collapse;width:100%;margin-bottom:8px"><tr>';
    h += '<td style="color:'+m+';padding:2px 12px 2px 0">Qubits</td><td style="color:'+w+'">'+report.qubitCount+'/'+report.backendQubits+'</td>';
    h += '<td style="color:'+m+';padding:2px 12px 2px 16px">Gates</td><td style="color:'+w+'">'+report.gateCount+'</td>';
    h += '<td style="color:'+m+';padding:2px 12px 2px 16px">Depth</td><td style="color:'+w+'">'+report.circuitDepth+'</td></tr><tr>';
    h += '<td style="color:'+m+';padding:2px 12px 2px 0">2Q gates</td><td style="color:'+w+'">'+report.twoQubitGates+'</td>';
    h += '<td style="color:'+m+';padding:2px 12px 2px 16px">Measure</td><td style="color:'+w+'">'+report.measureCount+'</td>';
    h += '<td style="color:'+m+';padding:2px 12px 2px 16px">Shots</td><td style="color:'+w+'">'+report.shots+'</td></tr></table>';
    h += '<div style="display:flex;gap:16px;margin-bottom:8px;flex-wrap:wrap">';
    h += '<span style="color:'+a+'">Score: <b>'+report.scorePct+'%</b></span>';
    h += '<span style="color:'+m+'">Fidelity: <b style="color:'+w+'">~'+report.estimatedFidelity.toFixed(2)+'%</b></span>';
    h += '<span style="color:'+m+'">Cost: <b style="color:'+w+'">~'+report.estimatedCost.toFixed(0)+' units</b></span>';
    h += '<span style="color:'+m+'">Family: '+report.backendFamily+'</span></div>';
    h += '<div style="margin-bottom:4px;color:'+a+';font-size:11px">CHECKS ('+report.passCount+'/'+report.checks.length+' pass)</div>';
    report.checks.forEach(function(c){
        var col = c.pass ? g : c.severity === 'critical' ? '#f85149' : c.severity === 'high' ? '#d29922' : m;
        var sev = c.severity === 'critical' ? ' !!!' : c.severity === 'high' ? ' !!' : '';
        h += '<div style="display:flex;gap:6px;padding:1px 0"><span style="color:'+col+'">'+(c.pass?'✓':'✗')+sev+'</span>';
        h += '<span style="color:'+col+';min-width:130px">'+c.name+'</span>';
        h += '<span style="color:'+w+'">'+c.detail+'</span></div>';
        if(!c.pass && c.costIfFail > 0) h += '<div style="color:#f85149;padding-left:24px;font-size:10px">↳ waste risk: '+c.costIfFail.toFixed(0)+' units</div>';
    });
    if(report.verdict === 'ABORT') h += '<div style="color:#f85149;font-weight:700;margin-top:6px">⛔ SUBMISSION BLOCKED — '+report.criticalFails+' critical · waste prevented: '+report.potentialWaste.toFixed(0)+' units</div>';
    else if(report.verdict === 'WARN') h += '<div style="color:#d29922;margin-top:6px">⚠ PROCEED WITH CAUTION — '+report.highFails+' warning(s)</div>';
    else h += '<div style="color:'+g+';margin-top:6px">✓ ALL CLEAR — safe to submit</div>';
    h += '<div style="margin-top:6px;padding-top:4px;border-top:1px solid #30363d;color:'+m+';font-size:10px">';
    h += 'Ecosystem: '+report.ledger.total+' submissions · '+report.failureRate+'% failure · '+report.ledger.costSaved.toFixed(0)+' units saved</div>';
    h += '</div>';
    return h;
}

// ━━━━━ Quick Validators ━━━━━
function validateFormat(src){
    if(!src) return {valid:false, format:'unknown', error:'Empty input'};
    if(src.indexOf('OPENQASM') >= 0) return {valid:true, format:'qasm', version: src.match(/OPENQASM\s+([\d.]+)/) ? RegExp.$1 : '2.0'};
    if(src.indexOf('__qbit__') >= 0 || src.indexOf('qbitCodec') >= 0) return {valid:true, format:'qbit'};
    try { var j = JSON.parse(src); if(j && (j.qubits || j.gates || j.params)) return {valid:true, format:'json'}; } catch(e){}
    return {valid:false, format:'unknown', error:'Unrecognized format — expected QASM, .qbit, or JSON'};
}

function estimateCost(qasm, backendName, shots){
    var backend = BACKEND_GATES[backendName];
    if(!backend) return {cost:0, error:'Unknown backend'};
    shots = shots || 4096;
    return {
        cost: backend.costPerShot * shots,
        shots: shots,
        backend: backendName,
        perShot: backend.costPerShot,
        family: backend.family,
        warning: (backend.costPerShot * shots) > 500 ? '$500+ submission — verify circuit before sending' : null
    };
}

// ━━━━━ Results Validator (post-retrieval quality check) ━━━━━
function validateResults(results, expectedQubits, expectedShots){
    var checks = [];
    if(!results) return {valid:false, checks:[{name:'Results exist', pass:false, detail:'No results data'}]};

    var states = Object.keys(results);
    var totalCounts = 0;
    states.forEach(function(s){ totalCounts += results[s]; });

    checks.push({name:'Has measurements', pass: states.length > 0, detail: states.length + ' unique states'});
    checks.push({name:'Shot count match', pass: Math.abs(totalCounts - expectedShots) < expectedShots*0.01, detail: totalCounts + '/' + expectedShots + ' shots'});

    if(expectedQubits){
        var maxBitLen = 0;
        states.forEach(function(s){ maxBitLen = Math.max(maxBitLen, s.replace(/[^01]/g,'').length); });
        checks.push({name:'Qubit width', pass: maxBitLen <= expectedQubits, detail: maxBitLen + '-bit states vs ' + expectedQubits + 'q circuit'});
    }

    // Entropy check: all-uniform suggests noise-dominated
    var entropy = 0;
    states.forEach(function(s){
        var p = results[s] / totalCounts;
        if(p > 0) entropy -= p * Math.log2(p);
    });
    var maxEntropy = Math.log2(states.length);
    var entropyRatio = maxEntropy > 0 ? entropy / maxEntropy : 0;
    checks.push({name:'Signal vs noise', pass: entropyRatio < 0.95, detail: 'Entropy ratio: ' + entropyRatio.toFixed(3) + (entropyRatio > 0.95 ? ' — near-uniform (noise-dominated)' : entropyRatio > 0.8 ? ' — moderate signal' : ' — good signal')});

    return {
        valid: checks.filter(function(c){return !c.pass;}).length === 0,
        checks: checks,
        uniqueStates: states.length,
        totalShots: totalCounts,
        entropy: entropy,
        entropyRatio: entropyRatio
    };
}

// ━━━━━ Calibration CSV Parser ━━━━━
// Ingests IBM Quantum calibration CSVs and updates backend stats + per-qubit data
function parseCalibrationCSV(csvText, backendName){
    if(!csvText || !backendName) return null;
    var lines = csvText.split('\n');
    if(lines.length < 2) return null;
    var headers = lines[0].split(',').map(function(h){return h.replace(/"/g,'').trim();});

    var colIdx = {};
    headers.forEach(function(h,i){colIdx[h]=i;});

    var qubits = [], t1s = [], t2s = [], readoutErrs = [], czErrs = [], sxErrs = [];
    var operational = 0, total = 0;

    for(var i=1;i<lines.length;i++){
        var raw=lines[i].trim();
        if(!raw) continue;
        var cols=[];
        var inQ=false, buf='';
        for(var ci=0;ci<raw.length;ci++){
            if(raw[ci]==='"') inQ=!inQ;
            else if(raw[ci]===','&&!inQ){cols.push(buf);buf='';}
            else buf+=raw[ci];
        }
        cols.push(buf);

        var qid=parseInt(cols[colIdx['Qubit']]||'0',10);
        var t1=parseFloat(cols[colIdx['T1 (us)']]||'0');
        var t2=parseFloat(cols[colIdx['T2 (us)']]||'0');
        var re=parseFloat(cols[colIdx['Readout assignment error']]||'0');
        var ide=parseFloat(cols[colIdx['ID error']]||'0');
        var sxe=parseFloat(cols[colIdx['√x (sx) error']]||cols[colIdx['SX error']]||'0');
        var op=(cols[colIdx['Operational']]||'').trim()==='Yes';

        var czRaw=cols[colIdx['CZ error']]||'';
        var czVals=[];
        czRaw.split(';').forEach(function(part){
            var v=part.split(':').pop();
            if(v){var f=parseFloat(v);if(!isNaN(f)&&f>0) czVals.push(f);}
        });
        var czAvg2=czVals.length>0?czVals.reduce(function(a,b){return a+b;},0)/czVals.length:0;

        total++;
        if(op) operational++;
        if(!isNaN(t1)&&t1>0) t1s.push(t1);
        if(!isNaN(t2)&&t2>0) t2s.push(t2);
        if(!isNaN(re)) readoutErrs.push(re);
        if(czAvg2>0) czErrs.push(czAvg2);
        if(!isNaN(sxe)&&sxe>0) sxErrs.push(sxe);

        qubits.push({
            id:qid,t1:t1,t2:t2,readoutError:re,idError:ide,sxError:sxe,
            czError:czAvg2,czPairs:czVals.length,operational:op
        });
    }

    function med(arr){if(!arr.length)return 0;var s=arr.slice().sort(function(a,b){return a-b;});var m=Math.floor(s.length/2);return s.length%2?s[m]:(s[m-1]+s[m])/2;}
    function avg(arr){return arr.length?arr.reduce(function(a,b){return a+b;},0)/arr.length:0;}

    var summary={
        qubits:total, operational:operational,
        t1Avg:+avg(t1s).toFixed(1), t1Med:+med(t1s).toFixed(1),
        t2Avg:+avg(t2s).toFixed(1), t2Med:+med(t2s).toFixed(1),
        readoutAvg:+avg(readoutErrs).toFixed(6), readoutMed:+med(readoutErrs).toFixed(6),
        czAvg:+avg(czErrs).toFixed(6), czMed:+med(czErrs).toFixed(6),
        czMax:czErrs.length?+Math.max.apply(null,czErrs).toFixed(6):0,
        sxAvg:+avg(sxErrs).toFixed(6),
        timestamp:Date.now()
    };

    if(BACKEND_GATES[backendName]){
        var bg=BACKEND_GATES[backendName];
        bg.t1Avg=summary.t1Avg;bg.t2Avg=summary.t2Avg;bg.t1Med=summary.t1Med;
        bg.errAvg=summary.czMed;bg.czAvg=summary.czAvg;bg.czMed=summary.czMed;
        bg.readoutAvg=summary.readoutAvg;bg.readoutMed=summary.readoutMed;
        bg.operational=summary.operational;bg.calibDate=new Date().toISOString();
    }

    calibrationCache[backendName]={
        timestamp:Date.now(),
        summary:summary,
        qubits:qubits,
        raw:csvText.length
    };
    try{if(typeof localStorage!=='undefined') localStorage.setItem('qbit-cal-'+backendName,JSON.stringify(calibrationCache[backendName]));}catch(e){}

    return {backend:backendName, summary:summary, qubits:qubits, count:total};
}

// ━━━━━ System Directory ━━━━━
// Compiled registry of all compute units: CPU/GPU/QPU/.qbit
function systemDirectory(){
    var systems=[];
    Object.keys(BACKEND_GATES).forEach(function(name){
        var bg=BACKEND_GATES[name];
        var cal=calibrationCache[name]||null;
        var calAge=cal&&cal.timestamp?(Date.now()-cal.timestamp):null;
        var calFresh=bg.family==='simulator'||( calAge!==null&&calAge<CALIB_MAX_AGE_MS);
        var type=bg.family==='simulator'?(bg.gen==='wgsl'?'GPU':bg.gen==='wasm'?'WASM':'CPU'):'QPU';

        systems.push({
            name:name,
            type:type,
            family:bg.family,
            generation:bg.gen,
            qubits:bg.qubits,
            operational:bg.operational||bg.qubits,
            gates:bg.gates,
            gateLen:bg.gateLen,
            t1Avg:bg.t1Avg,
            t2Avg:bg.t2Avg,
            t1Med:bg.t1Med,
            czAvg:bg.czAvg,
            czMed:bg.czMed,
            readoutAvg:bg.readoutAvg,
            readoutMed:bg.readoutMed,
            maxDepth:bg.maxDepth===Infinity?'∞':bg.maxDepth,
            costPerShot:bg.costPerShot,
            calibDate:bg.calibDate,
            calibFresh:calFresh,
            calibAgeMin:calAge!==null?Math.floor(calAge/60000):null,
            perQubitData:cal&&cal.qubits?cal.qubits.length:0,
            status:bg.operational===bg.qubits?'ONLINE':(bg.operational>0?'DEGRADED':'OFFLINE')
        });
    });

    var qpuCount=0,simCount=0,totalQubits=0,freshCount=0;
    systems.forEach(function(s){
        if(s.type==='QPU'){qpuCount++;totalQubits+=s.qubits;}else simCount++;
        if(s.calibFresh) freshCount++;
    });

    return {
        systems:systems,
        summary:{
            totalSystems:systems.length,
            qpuCount:qpuCount,
            simulatorCount:simCount,
            totalQubits:totalQubits,
            calibratedCount:freshCount,
            failureRate:ledger.total>0?(ledger.fail/ledger.total*100).toFixed(1):'0.0',
            ledger:{total:ledger.total,pass:ledger.pass,fail:ledger.fail,costSaved:ledger.costSaved}
        },
        timestamp:Date.now()
    };
}

// ━━━━━ Qubit Health Report ━━━━━
function qubitHealth(backendName, qubitId){
    var cal=calibrationCache[backendName];
    if(!cal||!cal.qubits) return null;
    var q=cal.qubits.find(function(qb){return qb.id===qubitId;});
    if(!q) return null;
    var bg=BACKEND_GATES[backendName];
    var score=100;
    if(q.t1<50) score-=30; else if(q.t1<100) score-=15; else if(q.t1<150) score-=5;
    if(q.czError>0.01) score-=30; else if(q.czError>0.005) score-=15; else if(q.czError>0.003) score-=5;
    if(q.readoutError>0.1) score-=20; else if(q.readoutError>0.05) score-=10; else if(q.readoutError>0.02) score-=5;
    if(!q.operational) score=0;
    return {
        qubit:qubitId, backend:backendName,
        t1:q.t1, t2:q.t2, readoutError:q.readoutError,
        czError:q.czError, operational:q.operational,
        healthScore:Math.max(0,score),
        grade:score>=80?'A':score>=60?'B':score>=40?'C':score>=20?'D':'F'
    };
}

// ━━━━━ Auto-load cached calibrations on boot ━━━━━
(function bootCalibrations(){
    ['ibm_torino','ibm_marrakesh','ibm_fez','ibm_brussels','ibm_strasbourg','ibm_kawasaki'].forEach(function(name){
        loadCalibration(name);
    });
})();

// ━━━━━ Export (isomorphic browser + Node.js) ━━━━━
// ━━━━━ Scan Data Validation ━━━━━
function validateScanData(cloud, opts){
    opts = opts || {};
    var checks = [];
    var pass = true;

    checks.push({name:'point_count', pass:cloud&&cloud.length>0, detail:cloud?cloud.length+' points':'0 points', severity:'critical'});
    if(!cloud||cloud.length===0) pass=false;

    var hasXYZ = cloud && cloud.length>0 && cloud[0].x!==undefined && cloud[0].y!==undefined;
    checks.push({name:'xyz_coords', pass:!!hasXYZ, detail:hasXYZ?'valid XYZ':'missing coordinates', severity:'critical'});
    if(!hasXYZ) pass=false;

    var hasBloch = cloud && cloud.length>0 && cloud[0].theta!==undefined;
    checks.push({name:'bloch_coords', pass:!!hasBloch, detail:hasBloch?'θ/φ present':'missing θ/φ — will compute', severity:'low'});

    var bounds = {x:[Infinity,-Infinity],y:[Infinity,-Infinity],z:[Infinity,-Infinity]};
    if(cloud) cloud.forEach(function(p){
        bounds.x[0]=Math.min(bounds.x[0],p.x);bounds.x[1]=Math.max(bounds.x[1],p.x);
        bounds.y[0]=Math.min(bounds.y[0],p.y);bounds.y[1]=Math.max(bounds.y[1],p.y);
        bounds.z[0]=Math.min(bounds.z[0],p.z||0);bounds.z[1]=Math.max(bounds.z[1],p.z||0);
    });
    var normalized = cloud && cloud.length>0 && bounds.x[1]<=1.1 && bounds.x[0]>=-1.1;
    checks.push({name:'normalized', pass:!!normalized, detail:normalized?'unit sphere':'raw coords — needs normalizing', severity:'high'});

    var hasSrc = cloud && cloud.length>0 && cloud[0].src;
    checks.push({name:'modality_tag', pass:!!hasSrc, detail:hasSrc?'source: '+cloud[0].src:'no modality tag', severity:'low'});

    var densityOk = cloud && cloud.length>=10;
    checks.push({name:'density', pass:!!densityOk, detail:cloud?cloud.length+' pts (min 10)':'0', severity:'high'});

    var passCount=0, failCount=0;
    checks.forEach(function(c){if(c.pass) passCount++; else failCount++;});

    return {
        valid: pass && failCount===0,
        verdict: failCount>0 && checks.some(function(c){return !c.pass&&c.severity==='critical';})?'ABORT':failCount>0?'WARN':'GO',
        checks: checks,
        passCount: passCount,
        failCount: failCount,
        pointCount: cloud?cloud.length:0,
        bounds: bounds,
        modality: (cloud&&cloud.length>0&&cloud[0].src)||'unknown'
    };
}

var QbitPreflight = {
    preflight: preflight,
    parseQASM: parseQASMPreflight,
    parseCalibrationCSV: parseCalibrationCSV,
    validateFormat: validateFormat,
    validateResults: validateResults,
    validateScanData: validateScanData,
    estimateCost: estimateCost,
    recordOutcome: recordOutcome,
    updateCalibration: updateCalibration,
    loadCalibration: loadCalibration,
    formatReportText: formatReportText,
    formatReportHTML: formatReportHTML,
    systemDirectory: systemDirectory,
    qubitHealth: qubitHealth,
    BACKEND_GATES: BACKEND_GATES,
    getCalibration: function(name){ return calibrationCache[name]||null; },
    getLedger: function(){ return ledger; },
    getFailureRate: function(){ return ledger.total > 0 ? (ledger.fail/ledger.total*100) : 0; },
    TARGET_FAILURE_RATE: 3.0,
    SCAN_MODALITIES: ['photogrammetry','sam2','gsplat','wifi3d','lidar','irflir','audio','contrail','qpu']
};

if(typeof module !== 'undefined' && module.exports) module.exports = QbitPreflight;
if(typeof root !== 'undefined') root.QbitPreflight = QbitPreflight;

})(typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : this);
