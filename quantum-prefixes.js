// Copyright (c) 2026 qbitOS / ugrad.ai. All rights reserved.
// SPDX-License-Identifier: Apache-2.0
// Source: https://github.com/qbitOS/compliance
// Provenance: ai-created-control-envelope
// DAC/Prefix/Steno/Iron-Line/Preflight/search-history controls
// Runtime Path: DAC -> Iron Line -> Prefixes -> Quantum Gutter -> .qbit -> preflight
/**
 * ⚛ quantum-prefixes.js — Shared Quantum Gutter Prefix Engine
 * Author: Tad R. Ericson
 * Licensing contact: license@qbitos.ai | license@ugrad.ai
 * Copyright (c) 2026 qbitOS / ugrad.ai. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 * Source: https://github.com/qbitOS/uvmis-evolution-agent
 * Provenance: build=<sha> artifact=<sha256>
 *
 * Universal module used by all UV-Speed apps (notepad, hexbench, hexterm,
 * hexcast, archflow, research-lab, dashboard, grid, launcher, etc.)
 *
 * Provides:
 *   • 11-symbol line classifier  (classifyLine)
 *   • Per-language regex rules   (LANG_PATTERNS)
 *   • Content prefixing          (prefixContent)
 *   • Metadata generation        (prefixMetadata)
 *   • Live cross-app sync        (BroadcastChannel 'quantum-prefixes')
 *   • IoT/Quantum bridge relay   (WebSocket → iot-quantum-computer)
 *   • localStorage persistence   (quantum-prefixes-state)
 *
 * Usage:
 *   <script src="quantum-prefixes.js"></script>
 *   const qp = window.QuantumPrefixes;
 *   const prefixed = qp.prefixContent(code, 'python');
 *   qp.broadcastState('hexbench', { cells: 5, coverage: 72 });
 */

(function (root) {
    'use strict';

    // 11-Symbol Prefix Map
    const PREFIXES = {
        shebang:   { sym: 'n:',  cls: 'pfx-shebang',   color: '#e2b714' },
        comment:   { sym: '+1:', cls: 'pfx-comment',    color: '#6a9955' },
        import:    { sym: '-n:', cls: 'pfx-import',     color: '#c586c0' },
        class:     { sym: '+0:', cls: 'pfx-class',      color: '#4ec9b0' },
        function:  { sym: '0:',  cls: 'pfx-function',   color: '#569cd6' },
        error:     { sym: '-1:', cls: 'pfx-error',      color: '#f44747' },
        condition: { sym: '+n:', cls: 'pfx-condition',   color: '#d7ba7d' },
        loop:      { sym: '+2:', cls: 'pfx-loop',       color: '#9cdcfe' },
        return:    { sym: '-0:', cls: 'pfx-return',     color: '#c586c0' },
        output:    { sym: '+3:', cls: 'pfx-output',     color: '#ce9178' },
        variable:  { sym: '1:',  cls: 'pfx-variable',   color: '#d4d4d4' },
        decorator: { sym: '+1:', cls: 'pfx-decorator',  color: '#dcdcaa' },
        default:   { sym: '   ', cls: 'pfx-default',    color: '#808080' },
    };

    // ANSI escape codes (for terminal rendering)
    const PREFIX_ANSI = {
        'n:':  '\x1b[33m',   // shebang — yellow
        '+1:': '\x1b[32m',   // comment — green
        '-n:': '\x1b[35m',   // import — magenta
        '+0:': '\x1b[36m',   // class — cyan
        '0:':  '\x1b[34m',   // function — blue
        '-1:': '\x1b[31m',   // error — red
        '+n:': '\x1b[33m',   // condition — yellow
        '+2:': '\x1b[36m',   // loop — cyan
        '-0:': '\x1b[35m',   // return — magenta
        '+3:': '\x1b[31m',   // output — red
        '1:':  '\x1b[37m',   // variable — white
        '   ': '\x1b[90m',   // default — dim
    };

    // Language Pattern Rules (regex per category)
    const LANG_PATTERNS = {
        python: {
            shebang:   /^#!.*python/,
            comment:   /^\s*#/,
            import:    /^\s*(import|from)\s/,
            class:     /^\s*class\s/,
            function:  /^\s*(def|async\s+def)\s/,
            decorator: /^\s*@/,
            error:     /^\s*(try|except|finally|raise)/,
            condition: /^\s*(if|elif|else)\b/,
            loop:      /^\s*(for|while)\s/,
            return:    /^\s*(return|yield)\s/,
            output:    /^\s*print\(/,
            variable:  /^\s*\w+\s*=/,
        },
        javascript: {
            shebang:   /^#!.*node/,
            comment:   /^\s*(\/\/|\/\*|\*)/,
            import:    /^\s*(import|require|const\s+.*=\s*require|export)/,
            class:     /^\s*(class|interface)\s/,
            function:  /^\s*(function\s|async\s+\w+\s*\(|static\s+[\w#]+\s*\(|get\s+\w+\s*\(|set\s+\w+\s*\(|\*\s*\w+\s*\(|const\s+\w+\s*=\s*(\(|async)|=>)/,
            error:     /^\s*(try|catch|finally|throw)\b/,
            condition: /^\s*(if|else\s+if|else|switch|case)\b/,
            loop:      /^\s*(for|while|do)\b/,
            return:    /^\s*(return|yield\*?)\s/,
            output:    /^\s*console\./,
            variable:  /^\s*(const|let|var)\s/,
        },
        typescript: {
            comment:   /^\s*(\/\/|\/\*|\*)/,
            import:    /^\s*(import|require|from|export)/,
            class:     /^\s*(class|interface|type|enum)\s/,
            function:  /^\s*(function\s|async\s+\w+\s*\(|static\s+[\w#]+\s*\(|get\s+\w+\s*\(|set\s+\w+\s*\(|\*\s*\w+\s*\(|const\s+\w+\s*[:=]|=>)/,
            decorator: /^\s*@/,
            error:     /^\s*(try|catch|finally|throw)\b/,
            condition: /^\s*(if|else|switch|case)\b/,
            loop:      /^\s*(for|while|do)\b/,
            return:    /^\s*(return|yield\*?)\s/,
            output:    /^\s*console\./,
            variable:  /^\s*(const|let|var)\s/,
        },
        rust: {
            comment:   /^\s*(\/\/|\/\*)/,
            import:    /^\s*(use|extern\s+crate|mod)\s/,
            class:     /^\s*(struct|enum|trait|impl)\s/,
            function:  /^\s*(pub\s+)?(fn|async\s+fn)\s/,
            decorator: /^\s*#\[/,
            error:     /^\s*(panic!|unwrap|expect|Result|Err)/,
            condition: /^\s*(if|else|match)\b/,
            loop:      /^\s*(for|while|loop)\b/,
            return:    /^\s*return\s/,
            output:    /^\s*(println!|print!|eprintln!)/,
            variable:  /^\s*(let|mut|const)\s/,
        },
        go: {
            comment:   /^\s*\/\//,
            import:    /^\s*(import|package)\s/,
            class:     /^\s*type\s+\w+\s+(struct|interface)/,
            function:  /^\s*func\s/,
            error:     /^\s*(if\s+err|panic\(|log\.(Fatal|Panic))/,
            condition: /^\s*(if|else|switch|case)\b/,
            loop:      /^\s*for\b/,
            return:    /^\s*return\s/,
            output:    /^\s*fmt\./,
            variable:  /^\s*(var|:=)\s/,
        },
        shell: {
            shebang:   /^#!\/(bin|usr)\/(bash|sh|zsh)/,
            comment:   /^\s*#/,
            import:    /^\s*(source|\.)\s/,
            function:  /^\s*(\w+\s*\(\)\s*\{|function\s+\w+)/,
            error:     /^\s*(trap|set\s+-e)/,
            condition: /^\s*(if|elif|else|fi|then)\b/,
            loop:      /^\s*(for|while|until|do|done)\b/,
            return:    /^\s*return\s/,
            output:    /^\s*echo\s/,
            variable:  /^\s*\w+=/,
        },
        c: {
            comment:   /^\s*(\/\/|\/\*|\*)/,
            import:    /^\s*#(include|define|pragma|ifdef|ifndef|endif)/,
            class:     /^\s*(struct|enum|union|typedef)\s/,
            function:  /^\s*(void|int|char|float|double|long|unsigned|static|extern)\s+\w+\s*\(/,
            error:     /^\s*(assert|abort|exit|perror)/,
            condition: /^\s*(if|else|switch|case)\b/,
            loop:      /^\s*(for|while|do)\b/,
            return:    /^\s*return\s/,
            output:    /^\s*(printf|puts|fprintf|sprintf)/,
            variable:  /^\s*(int|char|float|double|long|unsigned|const|static|volatile)\s+\w+/,
        },
        cpp: {
            comment:   /^\s*(\/\/|\/\*|\*)/,
            import:    /^\s*#(include|define|pragma|ifdef|ifndef|endif)|^\s*using\s/,
            class:     /^\s*(class|struct|enum|namespace|template)\s/,
            function:  /^\s*(void|int|char|float|double|auto|virtual|static|inline)\s+\w+\s*\(/,
            error:     /^\s*(try|catch|throw|assert)/,
            condition: /^\s*(if|else|switch|case)\b/,
            loop:      /^\s*(for|while|do)\b/,
            return:    /^\s*return\s/,
            output:    /^\s*(std::cout|std::cerr|printf|puts)/,
            variable:  /^\s*(int|char|float|double|auto|const|static|std::)\s*\w+/,
        },
        html: {
            comment:   /^\s*<!--/,
            import:    /^\s*<(link|script|meta)/,
            class:     /^\s*<(div|section|article|main|header|footer|nav)/,
            function:  /^\s*<(form|button|input)/,
            condition: /^\s*<(template|slot)/,
            output:    /^\s*<(p|h[1-6]|span|a|li|td)/,
        },
        css: {
            comment:   /^\s*\/\*/,
            import:    /^\s*@(import|charset|font-face)/,
            class:     /^\s*\./,
            variable:  /^\s*--/,
            condition: /^\s*@(media|supports|keyframes)/,
        },
        markdown: {
            shebang:   /^---/,
            comment:   /^\s*<!--/,
            import:    /^\s*!\[/,
            class:     /^\s*#{1,6}\s/,
            function:  /^\s*```/,
            condition: /^\s*>/,
            loop:      /^\s*[-*+]\s/,
            output:    /^\s*\|/,
            variable:  /^\s*\[.*\]:/,
        },
        mermaid: {
            comment:   /^\s*%%/,
            class:     /^\s*(graph|subgraph|flowchart|sequenceDiagram|classDiagram|stateDiagram|gantt|pie|erDiagram|journey)/,
            function:  /^\s*(style|click|class)\b/,
            condition: /^\s*(end|direction)\b/,
            output:    /-->/,
            variable:  /^\s*\w+[\[\({"]/,
        },
        sql: {
            comment:   /^\s*--/,
            import:    /^\s*(USE|DATABASE)\b/i,
            class:     /^\s*(CREATE|ALTER|DROP)\b/i,
            function:  /^\s*(SELECT|INSERT|UPDATE|DELETE)\b/i,
            condition: /^\s*(WHERE|CASE|WHEN|IF)\b/i,
            loop:      /^\s*(JOIN|UNION|GROUP)\b/i,
        },
        yaml: {
            comment:   /^\s*#/,
            import:    /^\s*---/,
            variable:  /^\s*\w+\s*:/,
            class:     /^\s*-\s/,
        },
        json: {
            class:     /^\s*\{/,
            variable:  /^\s*"/,
            loop:      /^\s*\[/,
        },
        arduino: {
            comment:   /^\s*(\/\/|\/\*|\*)/,
            import:    /^\s*#(include|define)/,
            class:     /^\s*(struct|enum|class)\s/,
            function:  /^\s*(void|int|float|char|byte|boolean|unsigned|long)\s+\w+\s*\(/,
            error:     /^\s*(Serial\.print|assert)/,
            condition: /^\s*(if|else|switch|case)\b/,
            loop:      /^\s*(for|while|do)\b/,
            return:    /^\s*return\s/,
            output:    /^\s*(Serial\.(print|write|begin)|analogWrite|digitalWrite)/,
            variable:  /^\s*(int|float|char|byte|boolean|unsigned|long|const|#define)\s+\w+/,
        },
        nushell: {
            shebang:   /^#!.*nu/,
            comment:   /^\s*#/,
            import:    /^\s*(use|source|overlay\s+use)\s/,
            class:     /^\s*(module)\s/,
            function:  /^\s*(def|def-env|export\s+def)\s/,
            error:     /^\s*(try|catch|error\s+make)\b/,
            condition: /^\s*(if|else|match)\b/,
            loop:      /^\s*(for|each|while|loop)\b/,
            return:    /^\s*return\s/,
            output:    /^\s*(print|echo)\s/,
            variable:  /^\s*(let|let-env|mut|\$\w+\s*=)/,
        },
        java: {
            comment:   /^\s*(\/\/|\/\*|\*)/,
            import:    /^\s*(import|package)\s/,
            class:     /^\s*(public\s+)?(class|interface|enum|abstract\s+class|record)\s/,
            function:  /^\s*(public|private|protected|static|void|int|String|boolean)\s+\w+\s*\(/,
            decorator: /^\s*@/,
            error:     /^\s*(try|catch|finally|throw|throws)\b/,
            condition: /^\s*(if|else|switch|case)\b/,
            loop:      /^\s*(for|while|do)\b/,
            return:    /^\s*return\s/,
            output:    /^\s*System\.out\./,
            variable:  /^\s*(int|String|boolean|double|float|long|char|var|final)\s+\w+/,
        },
        swift: {
            shebang:   /^#!.*swift/,
            comment:   /^\s*(\/\/|\/\*|\*)/,
            import:    /^\s*import\s/,
            class:     /^\s*(class|struct|enum|protocol|extension|actor)\s/,
            function:  /^\s*(func|init|deinit)\s/,
            decorator: /^\s*@/,
            error:     /^\s*(try|catch|throw|do\s*\{|guard)\b/,
            condition: /^\s*(if|else|switch|case|guard)\b/,
            loop:      /^\s*(for|while|repeat)\b/,
            return:    /^\s*return\s/,
            output:    /^\s*print\(/,
            variable:  /^\s*(let|var)\s/,
        },
        kotlin: {
            comment:   /^\s*(\/\/|\/\*|\*)/,
            import:    /^\s*(import|package)\s/,
            class:     /^\s*(class|data\s+class|sealed\s+class|object|interface|enum\s+class)\s/,
            function:  /^\s*(fun|suspend\s+fun)\s/,
            decorator: /^\s*@/,
            error:     /^\s*(try|catch|finally|throw)\b/,
            condition: /^\s*(if|else|when)\b/,
            loop:      /^\s*(for|while|do)\b/,
            return:    /^\s*return\s/,
            output:    /^\s*println\(/,
            variable:  /^\s*(val|var)\s/,
        },
        elixir: {
            comment:   /^\s*#/,
            import:    /^\s*(import|alias|require|use)\s/,
            class:     /^\s*defmodule\s/,
            function:  /^\s*(def|defp|defmacro|defguard)\s/,
            decorator: /^\s*@/,
            error:     /^\s*(try|rescue|catch|raise|throw)\b/,
            condition: /^\s*(if|else|unless|cond|case)\b/,
            loop:      /^\s*(for|Enum\.|Stream\.)/,
            return:    /^\s*return\s/,
            output:    /^\s*IO\.(puts|write|inspect)/,
            variable:  /^\s*\w+\s*=/,
        },
        julia: {
            comment:   /^\s*#/,
            import:    /^\s*(using|import|include)\s/,
            class:     /^\s*(struct|mutable\s+struct|abstract\s+type|primitive\s+type)\s/,
            function:  /^\s*function\s/,
            error:     /^\s*(try|catch|finally|throw|error)\b/,
            condition: /^\s*(if|elseif|else)\b/,
            loop:      /^\s*(for|while)\b/,
            return:    /^\s*return\s/,
            output:    /^\s*(println|print|@show|@info)/,
            variable:  /^\s*(const\s+)?\w+\s*=/,
        },
        scala: {
            comment:   /^\s*(\/\/|\/\*|\*)/,
            import:    /^\s*import\s/,
            class:     /^\s*(class|object|trait|case\s+class|sealed\s+trait|abstract\s+class)\s/,
            function:  /^\s*def\s/,
            error:     /^\s*(try|catch|finally|throw)\b/,
            condition: /^\s*(if|else|match)\b/,
            loop:      /^\s*(for|while)\b/,
            return:    /^\s*return\s/,
            output:    /^\s*println\(/,
            variable:  /^\s*(val|var|lazy\s+val)\s/,
        },
        clojure: {
            comment:   /^\s*(;|;;)/,
            import:    /^\s*\((ns|require|use|import)\b/,
            class:     /^\s*\((defrecord|defprotocol|deftype|defmulti)\b/,
            function:  /^\s*\((defn|defn-|fn|defmacro)\b/,
            error:     /^\s*\((try|catch|finally|throw)\b/,
            condition: /^\s*\((if|when|cond|case)\b/,
            loop:      /^\s*\((for|loop|doseq|dotimes|while)\b/,
            return:    /^\s*\((recur)\b/,
            output:    /^\s*\((println|print|prn)\b/,
            variable:  /^\s*\((def|let|binding|atom)\b/,
        },
        nim: {
            comment:   /^\s*#/,
            import:    /^\s*(import|from|include)\s/,
            class:     /^\s*type\s/,
            function:  /^\s*(proc|func|method|template|macro|iterator)\s/,
            error:     /^\s*(try|except|finally|raise)\b/,
            condition: /^\s*(if|elif|else|case|when)\b/,
            loop:      /^\s*(for|while)\b/,
            return:    /^\s*(return|result\s*=)/,
            output:    /^\s*echo\s/,
            variable:  /^\s*(var|let|const)\s/,
        },
        csharp: {
            comment:   /^\s*(\/\/|\/\*|\*)/,
            import:    /^\s*using\s/,
            class:     /^\s*(public\s+)?(class|struct|interface|enum|record|namespace)\s/,
            function:  /^\s*(public|private|protected|internal|static|void|async|override)\s+\w+.*\(/,
            decorator: /^\s*\[/,
            error:     /^\s*(try|catch|finally|throw)\b/,
            condition: /^\s*(if|else|switch|case)\b/,
            loop:      /^\s*(for|foreach|while|do)\b/,
            return:    /^\s*return\s/,
            output:    /^\s*Console\.(Write|WriteLine)/,
            variable:  /^\s*(var|int|string|bool|double|float|const|readonly)\s+\w+/,
        },
        php: {
            shebang:   /^<\?php/,
            comment:   /^\s*(\/\/|\/\*|\*|#)/,
            import:    /^\s*(use|require|include|require_once|include_once)\s/,
            class:     /^\s*(class|interface|trait|enum|abstract\s+class|namespace)\s/,
            function:  /^\s*(function|public\s+function|private\s+function|protected\s+function)\s/,
            error:     /^\s*(try|catch|finally|throw)\b/,
            condition: /^\s*(if|elseif|else|switch|case|match)\b/,
            loop:      /^\s*(for|foreach|while|do)\b/,
            return:    /^\s*return\s/,
            output:    /^\s*(echo|print|var_dump|print_r)\b/,
            variable:  /^\s*\$\w+\s*=/,
        },
        erlang: {
            comment:   /^\s*%/,
            import:    /^\s*-(module|export|import|include|behaviour)\(/,
            class:     /^\s*-(record|type|opaque|spec)\(/,
            function:  /^\s*\w+\s*\(.*\)\s*->/,
            error:     /^\s*(try|catch|throw|error)\b/,
            condition: /^\s*(case|if|of|when)\b/,
            loop:      /^\s*(receive|lists:(map|foreach|foldl))/,
            return:    /^\s*ok\b/,
            output:    /^\s*io:(format|fwrite)/,
            variable:  /^\s*[A-Z]\w*\s*=/,
        },
        crystal: {
            comment:   /^\s*#/,
            import:    /^\s*require\s/,
            class:     /^\s*(class|struct|module|enum|lib|annotation)\s/,
            function:  /^\s*(def|macro)\s/,
            error:     /^\s*(begin|rescue|ensure|raise)\b/,
            condition: /^\s*(if|elsif|else|unless|case|when)\b/,
            loop:      /^\s*(while|until|loop|each)\b/,
            return:    /^\s*return\s/,
            output:    /^\s*(puts|print|pp)\b/,
            variable:  /^\s*\w+\s*=/,
        },
        powershell: {
            shebang:   /^#!.*pwsh/,
            comment:   /^\s*(#|<#)/,
            import:    /^\s*(Import-Module|using\s+(module|namespace))\b/,
            class:     /^\s*(class|enum)\s/,
            function:  /^\s*function\s/,
            error:     /^\s*(try|catch|finally|throw|trap)\b/,
            condition: /^\s*(if|elseif|else|switch)\b/,
            loop:      /^\s*(for|foreach|while|do)\b/,
            return:    /^\s*return\s/,
            output:    /^\s*(Write-Host|Write-Output|Write-Error|Write-Verbose)\b/,
            variable:  /^\s*\$\w+\s*=/,
        },
        haskell: {
            comment:   /^\s*(--|{-)/,
            import:    /^\s*(import|module)\s/,
            class:     /^\s*(data|newtype|type|class|instance)\s/,
            function:  /^\s*\w+\s*::|\w+\s+.*=/,
            error:     /^\s*(error|throw|catch|handle|try)\b/,
            condition: /^\s*(if|then|else|case|of|guard)\b/,
            loop:      /^\s*(map|filter|foldl|foldr|mapM|forM)\b/,
            return:    /^\s*return\s/,
            output:    /^\s*(putStrLn|putStr|print|hPutStrLn)\b/,
            variable:  /^\s*(let|where)\b/,
        },
        wasm: {
            comment:   /^\s*;;/,
            import:    /^\s*\(import\b/,
            class:     /^\s*\(module\b/,
            function:  /^\s*\(func\b/,
            error:     /^\s*\(throw\b/,
            condition: /^\s*\((if|br_if|br_table)\b/,
            loop:      /^\s*\((loop|block|br)\b/,
            return:    /^\s*\(return\b/,
            output:    /^\s*\((call\s+\$print|call\s+\$log)\b/,
            variable:  /^\s*\((local|global|param)\b/,
        },
        coffeescript: {
            comment:   /^\s*#/,
            import:    /^\s*(require|import)\b/,
            class:     /^\s*class\s/,
            function:  /^\s*\w+\s*[:=]\s*(\(.*\)\s*)?[-=]>/,
            error:     /^\s*(try|catch|finally|throw)\b/,
            condition: /^\s*(if|else|unless|switch|when)\b/,
            loop:      /^\s*(for|while|until|loop)\b/,
            return:    /^\s*return\s/,
            output:    /^\s*console\./,
            variable:  /^\s*\w+\s*=/,
        },
        micropython: {
            shebang:   /^#!.*micropython/,
            comment:   /^\s*#/,
            import:    /^\s*(import|from)\s/,
            class:     /^\s*class\s/,
            function:  /^\s*(def|async\s+def)\s/,
            error:     /^\s*(try|except|finally|raise)/,
            condition: /^\s*(if|elif|else)\b/,
            loop:      /^\s*(for|while)\s/,
            return:    /^\s*(return|yield)\s/,
            output:    /^\s*(print\(|machine\.|utime\.)/,
            variable:  /^\s*\w+\s*=/,
        },
        transcript: {
            shebang:   /^(welcome|hello|hi everyone|good (morning|afternoon|evening)|today we|my name is|i'm going to)/i,
            comment:   /^(\[.*\]|\(.*\)|♪|>>|\*)/,
            import:    /\b(as (shown|described|published) in|see (the|our)|from (ar[xX]iv|paper|documentation)|refer(ence|ring) to)\b/i,
            class:     /\b(quantum (annealing|computing|simulation|supremacy|dynamics)|a (qubit|hamiltonian|coupler|spin glass) is|defined as|the (definition|concept) of)\b/i,
            function:  /\b(to (solve|implement|compute|optimize|simulate|approach) (this|the|a)|the (algorithm|method|process|technique) (works|uses)|submit(ting)? to|you (can|would|should) (do|run|use))\b/i,
            error:     /\b(however|the (limitation|caveat|problem|issue|challenge) is|error (rate|correction)|decoherence|noise|impractical|impossible to)\b/i,
            condition: /\b(compared to (classical|gate.model)|versus|if (you|we) (instead|compare)|on the other hand|in contrast|whereas|alternatively)\b/i,
            loop:      /\b(for (each|every|all) (qubit|sample|spin|iteration)|across all|repeat(ing)? the (anneal|process|measurement)|iteratively)\b/i,
            return:    /\b(therefore|in (summary|conclusion)|the (takeaway|result|outcome|finding) is|to (wrap|sum) up|so (what|the)|this (means|shows|tells))\b/i,
            output:    /\b(let me show|running (this|it) on (hardware|the processor)|the (result|data|output) (is|looks|shows)|here (you|we) (can see|have)|demonstrated)\b/i,
            variable:  /\b(\d[\d,.]+ (qubits|cubits|spins|variables|percent|%|shots|microseconds|nanoseconds|μs|ns|mK|MHz|GHz))\b/i,
        },
        // ── AI / LLM ────────────────────────────────────
        modelfile: {
            comment:   /^\s*#/,
            import:    /^\s*FROM\s/,
            variable:  /^\s*(PARAMETER|TEMPLATE|SYSTEM|LICENSE|ADAPTER)\s/,
            function:  /^\s*MESSAGE\s/,
            output:    /^\s*SYSTEM\s/,
        },
        prompt: {
            comment:   /^\s*(#|<!--)/,
            class:     /^\s*\[(system|user|assistant|tool)\]/i,
            function:  /^\s*\{\{#(if|each|unless|with)\b/,
            condition: /^\s*\{%\s*(if|elif|else|endif|for|endfor)\b/,
            variable:  /^\s*\{\{\s*\w+/,
            output:    /^\s*\{\{\s*(content|message|response)\b/,
            loop:      /^\s*\{\{#each\b/,
        },
        jsonschema: {
            comment:   /^\s*\/\//,
            class:     /^\s*"(inputSchema|definitions|parameters|components)"/,
            function:  /^\s*"(properties|items|allOf|oneOf|anyOf)"/,
            variable:  /^\s*"(type|name|description|required|default|enum)"/,
            import:    /^\s*"\$ref"/,
            condition: /^\s*"(if|then|else|not)"/,
        },
        // ── Quantum ─────────────────────────────────────
        qasm: {
            comment:   /^\s*\/\//,
            import:    /^\s*(OPENQASM|include)\s/,
            class:     /^\s*(qreg|creg|qubit|bit)\s/,
            function:  /^\s*(gate|defcal|def)\s/,
            condition: /^\s*if\s*\(/,
            loop:      /^\s*for\s/,
            output:    /^\s*measure\s/,
            return:    /^\s*reset\s/,
            variable:  /^\s*(U|rx|ry|rz|h|cx|cz|ccx|sx|s|t|swap|id)\s*[\(\[]/i,
        },
        quil: {
            comment:   /^\s*#/,
            import:    /^\s*PRAGMA\s/,
            class:     /^\s*(DEFGATE|DEFCIRCUIT)\s/,
            function:  /^\s*(DECLARE|DEFCAL)\s/,
            output:    /^\s*MEASURE\s/,
            condition: /^\s*(JUMP-WHEN|JUMP-UNLESS)\s/,
            loop:      /^\s*LABEL\s/,
            return:    /^\s*HALT\s/,
            variable:  /^\s*(RX|RY|RZ|CNOT|H|X|Y|Z|CZ|SWAP|CCNOT|ISWAP)\s/,
        },
        qsharp: {
            comment:   /^\s*\/\//,
            import:    /^\s*open\s/,
            class:     /^\s*namespace\s/,
            function:  /^\s*(operation|function)\s/,
            error:     /^\s*(fail|within|apply)\b/,
            condition: /^\s*(if|elif|else)\b/,
            loop:      /^\s*(for|repeat|while)\b/,
            return:    /^\s*return\s/,
            output:    /^\s*Message\s*\(/,
            variable:  /^\s*(let|mutable|use|borrow)\s/,
        },
        // ── Hardware / GPU / HDL ────────────────────────
        wgsl: {
            comment:   /^\s*\/\//,
            import:    /^\s*enable\s/,
            class:     /^\s*struct\s/,
            function:  /^\s*fn\s/,
            decorator: /^\s*@(group|binding|vertex|fragment|compute|workgroup_size)/,
            condition: /^\s*(if|else|switch)\b/,
            loop:      /^\s*(loop|for|while|continuing)\b/,
            return:    /^\s*return\s/,
            variable:  /^\s*(let|var|const|override)\s/,
        },
        cuda: {
            comment:   /^\s*(\/\/|\/\*|\*)/,
            import:    /^\s*#(include|define|pragma)/,
            class:     /^\s*(struct|enum|class|namespace)\s/,
            function:  /^\s*(__global__|__device__|__host__)\s/,
            error:     /^\s*(cudaError|cudaGetLastError|assert)/,
            condition: /^\s*(if|else|switch|case)\b/,
            loop:      /^\s*(for|while|do)\b/,
            return:    /^\s*return\s/,
            output:    /^\s*(printf|cudaMemcpy|cudaDeviceSynchronize)/,
            variable:  /^\s*(int|float|double|__shared__|dim3|cudaMalloc)\s/,
        },
        opencl: {
            comment:   /^\s*(\/\/|\/\*)/,
            import:    /^\s*#(include|define|pragma)/,
            class:     /^\s*(struct|typedef)\s/,
            function:  /^\s*(__kernel|kernel)\s/,
            variable:  /^\s*(__global|__local|__private|__constant)\s/,
            condition: /^\s*(if|else|switch)\b/,
            loop:      /^\s*(for|while)\b/,
            return:    /^\s*return\s/,
            output:    /^\s*(printf|get_global_id|get_local_id)\s*\(/,
        },
        verilog: {
            comment:   /^\s*\/\//,
            import:    /^\s*`(include|define|timescale|ifdef|endif)/,
            class:     /^\s*(module|endmodule|interface|program)\b/,
            function:  /^\s*(always|always_ff|always_comb|initial|task|function)\b/,
            condition: /^\s*(if|else|case|casex|casez)\b/,
            loop:      /^\s*(for|while|repeat|forever)\b/,
            return:    /^\s*(assign|endfunction|endtask)\b/,
            output:    /^\s*(\$display|\$monitor|\$write|\$finish)\b/,
            variable:  /^\s*(wire|reg|logic|input|output|inout|integer|parameter|localparam)\s/,
        },
        vhdl: {
            comment:   /^\s*--/,
            import:    /^\s*(library|use)\s/i,
            class:     /^\s*(entity|architecture|package|component)\s/i,
            function:  /^\s*(process|procedure|function)\b/i,
            condition: /^\s*(if|elsif|else|case|when)\b/i,
            loop:      /^\s*(for|while|loop)\b/i,
            return:    /^\s*return\s/i,
            output:    /^\s*(report|assert)\b/i,
            variable:  /^\s*(signal|variable|constant|port|generic)\s/i,
        },
        // ── Data Pipeline / Config ───────────────────────
        toml: {
            comment:   /^\s*#/,
            class:     /^\s*\[{1,2}[\w.-]+\]{1,2}/,
            variable:  /^\s*[\w-]+\s*=/,
            import:    /^\s*\[\[.*include/,
        },
        ini: {
            comment:   /^\s*[;#]/,
            class:     /^\s*\[[\w\s.-]+\]/,
            variable:  /^\s*[\w.-]+\s*=/,
        },
        protobuf: {
            comment:   /^\s*\/\//,
            import:    /^\s*(import|package)\s/,
            class:     /^\s*(message|enum|service|oneof)\s/,
            function:  /^\s*rpc\s/,
            variable:  /^\s*(optional|required|repeated|map|string|int32|int64|bool|float|double|bytes)\s/,
            condition: /^\s*(option|extend)\s/,
        },
        graphql: {
            comment:   /^\s*#/,
            class:     /^\s*(type|interface|enum|union|input|scalar)\s/,
            function:  /^\s*(query|mutation|subscription)\s/,
            import:    /^\s*(schema|directive|extend)\s/,
            variable:  /^\s*\w+\s*[:(]/,
            decorator: /^\s*@/,
            condition: /^\s*(fragment|on)\s/,
        },
        // ── Infrastructure ──────────────────────────────
        dockerfile: {
            comment:   /^\s*#/,
            import:    /^\s*FROM\s/,
            class:     /^\s*(WORKDIR|COPY|ADD)\s/,
            function:  /^\s*(RUN|CMD|ENTRYPOINT)\s/,
            variable:  /^\s*(ENV|ARG|LABEL)\s/,
            output:    /^\s*(EXPOSE|VOLUME|HEALTHCHECK)\s/,
            condition: /^\s*(ONBUILD|STOPSIGNAL)\s/,
        },
        terraform: {
            comment:   /^\s*(#|\/\/)/,
            import:    /^\s*(terraform|provider|module)\s/,
            class:     /^\s*(resource|data)\s/,
            function:  /^\s*(output|variable|locals)\s/,
            variable:  /^\s*\w+\s*=\s*/,
            condition: /^\s*(count|for_each|dynamic)\s/,
            loop:      /^\s*for\s/,
        },
        nginx: {
            comment:   /^\s*#/,
            class:     /^\s*(server|http|events|upstream|stream)\s*\{/,
            function:  /^\s*location\s/,
            variable:  /^\s*(listen|server_name|root|index|ssl_certificate|proxy_pass|fastcgi_pass)\s/,
            condition: /^\s*(if|set)\s/,
            output:    /^\s*(return|rewrite|error_page|add_header)\s/,
            import:    /^\s*include\s/,
        },
        // ── Scripting ───────────────────────────────────
        lua: {
            comment:   /^\s*--/,
            import:    /^\s*(require|dofile|loadfile)\s*[\("]/,
            class:     /^\s*\w+\s*=\s*\{/,
            function:  /^\s*(local\s+)?function\s/,
            error:     /^\s*(pcall|xpcall|error|assert)\b/,
            condition: /^\s*(if|elseif|else|then)\b/,
            loop:      /^\s*(for|while|repeat)\b/,
            return:    /^\s*return\s/,
            output:    /^\s*(print|io\.write|io\.read)\s*\(/,
            variable:  /^\s*local\s/,
        },
        ruby: {
            shebang:   /^#!.*ruby/,
            comment:   /^\s*#/,
            import:    /^\s*(require|require_relative|include|extend|load)\s/,
            class:     /^\s*(class|module)\s/,
            function:  /^\s*def\s/,
            error:     /^\s*(begin|rescue|ensure|raise)\b/,
            condition: /^\s*(if|elsif|else|unless|case|when)\b/,
            loop:      /^\s*(while|until|for|each|loop|times)\b/,
            return:    /^\s*return\s/,
            output:    /^\s*(puts|print|p|pp)\s/,
            variable:  /^\s*(@{0,2}\w+|[A-Z]\w*)\s*=/,
        },
        zig: {
            comment:   /^\s*\/\//,
            import:    /^\s*(@import|@cImport)\s*\(/,
            class:     /^\s*(const\s+\w+\s*=\s*struct|pub\s+const\s+\w+\s*=\s*enum|union)\b/,
            function:  /^\s*(pub\s+)?fn\s/,
            error:     /^\s*(try|catch|@panic|unreachable)\b/,
            condition: /^\s*(if|else|switch)\b/,
            loop:      /^\s*(while|for)\b/,
            return:    /^\s*return\s/,
            output:    /^\s*std\.debug\.print/,
            variable:  /^\s*(var|const)\s/,
        },
        assembly: {
            comment:   /^\s*[;#@]/,
            import:    /^\s*(%include|\.include|\.extern|extern)\b/,
            class:     /^\s*\.(section|segment|data|bss|text|global|globl)\b/,
            function:  /^\s*\w+:\s*$/,
            condition: /^\s*(je|jne|jz|jnz|jg|jl|jge|jle|ja|jb|cmp|test)\b/i,
            loop:      /^\s*(loop|rep|jmp)\b/i,
            return:    /^\s*(ret|iret|sysret)\b/i,
            output:    /^\s*(int\s+0x80|syscall|call\s+_?printf)\b/i,
            variable:  /^\s*(mov|lea|push|pop|xor|add|sub|mul|div|inc|dec)\b/i,
        },
        // ── Mobile ──────────────────────────────────────
        dart: {
            comment:   /^\s*(\/\/|\/\*|\*)/,
            import:    /^\s*(import|export|part|library)\s/,
            class:     /^\s*(class|abstract\s+class|mixin|extension|enum)\s/,
            function:  /^\s*(void|Future|Stream|Widget|State|int|double|String|bool|dynamic|var)\s+\w+\s*\(/,
            decorator: /^\s*@/,
            error:     /^\s*(try|catch|finally|throw|rethrow)\b/,
            condition: /^\s*(if|else|switch|case)\b/,
            loop:      /^\s*(for|while|do)\b/,
            return:    /^\s*return\s/,
            output:    /^\s*(print|debugPrint|log)\s*\(/,
            variable:  /^\s*(var|final|const|late)\s/,
        },
        // ── AI-era Editor Formats ───────────────────────
        mdc: {
            shebang:   /^---/,
            comment:   /^\s*(<!--|#\s)/,
            import:    /^\s*(alwaysApply|globs|description)\s*:/,
            class:     /^\s*#{1,6}\s/,
            function:  /^\s*```/,
            condition: /^\s*>/,
            loop:      /^\s*[-*+]\s/,
            output:    /^\s*\|/,
            variable:  /^\s*[\w-]+\s*:/,
        },
        // ── Expansion: .qbit codec + Contrails language ──
        qbit: {
            shebang:   /^\s*n:\s/,
            comment:   /^\s*\+1:\s/,
            import:    /^\s*-n:\s/,
            class:     /^\s*\+0:\s/,
            function:  /^\s*0:\s/,
            error:     /^\s*-1:\s/,
            condition: /^\s*\+n:\s/,
            loop:      /^\s*\+2:\s/,
            return:    /^\s*-0:\s/,
            output:    /^\s*\+3:\s/,
            variable:  /^\s*1:\s/,
        },
        contrail: {
            comment:   /^\s*[∘○⊤⊥]\s/,
            import:    /^\s*[←]\s/,
            class:     /^\s*[⊞]\s/,
            function:  /^\s*[▶●⊢]\s/,
            error:     /^\s*[⊥⊟]\s/,
            condition: /^\s*[◇⇒]\s/,
            loop:      /^\s*[∀]\s/,
            return:    /^\s*[→]\s/,
            output:    /^\s*[⊙]\s/,
            variable:  /^\s*[□⊗]\s/,
        },
    };

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // Pre-compiled Pattern Arrays + Result Cache
    // Eliminates Object.entries() and { ...spread } per classifyLine call
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    var RESULT_CACHE = {}, COMPILED = {};
    for (var _c in PREFIXES) if (PREFIXES.hasOwnProperty(_c)) { var _p = PREFIXES[_c]; RESULT_CACHE[_c] = { sym: _p.sym, cls: _p.cls, color: _p.color, category: _c }; }
    var VARIABLE_RESULT = RESULT_CACHE.variable, DEFAULT_RESULT = RESULT_CACHE['default'];
    for (var _l in LANG_PATTERNS) if (LANG_PATTERNS.hasOwnProperty(_l)) { var _a = []; for (var _k in LANG_PATTERNS[_l]) if (LANG_PATTERNS[_l].hasOwnProperty(_k)) _a.push([LANG_PATTERNS[_l][_k], RESULT_CACHE[_k] || DEFAULT_RESULT]); COMPILED[_l] = _a; }
    var COMPILED_PYTHON = COMPILED.python;

    // Language Detection (auto-detect from content)
    function detectLanguage(content, hint) {
        if (hint && LANG_PATTERNS[hint]) return hint;
        const c = content || '';
        // Shebang detection
        if (/^#!.*python/.test(c)) return 'python';
        if (/^#!.*node/.test(c)) return 'javascript';
        if (/^#!\/(bin|usr)/.test(c)) return 'shell';
        // Arduino / C++ patterns
        if (/#include\s*<Arduino\.h>|void\s+setup\(\)|void\s+loop\(\)/m.test(c)) return 'arduino';
        // Language keyword heuristics
        if (/^\s*(import|from)\s.*\n.*def\s/m.test(c)) return 'python';
        if (/^\s*def\s|^\s*class\s.*:/m.test(c)) return 'python';
        if (/^\s*(const|let|var|function|=>|require\(|import\s.*from)/m.test(c)) return 'javascript';
        if (/^\s*(fn\s|let\s+mut|impl\s|use\s+\w+::)/m.test(c)) return 'rust';
        if (/^\s*(func\s|package\s|fmt\.)/m.test(c)) return 'go';
        if (/^\s*(SELECT|CREATE|INSERT|ALTER)\b/im.test(c)) return 'sql';
        if (/^\s*<(!DOCTYPE|html|div|section)/im.test(c)) return 'html';
        if (/^\s*(@media|\.[\w-]+\s*\{)/m.test(c)) return 'css';
        if (/^\s*(graph|flowchart|sequenceDiagram|classDiagram)/m.test(c)) return 'mermaid';
        if (/^\s*---\s*\n/m.test(c) && /^\s*\w+:/m.test(c)) return 'yaml';
        if (/^\s*\{[\s]*"/.test(c)) return 'json';
        if (/^\s*#.*\n/m.test(c) && /^\s*(echo|export|source)\b/m.test(c)) return 'shell';
        if (/^\s*#(include|define)/.test(c) && /^\s*(void|int|char)\s+\w+\s*\(/m.test(c)) return 'c';
        // Nushell
        if (/^\s*(def\s+\w+\s*\[|let-env|def-env)\b/m.test(c)) return 'nushell';
        // Java
        if (/^\s*(public\s+class|import\s+java\.|package\s+\w+)/m.test(c)) return 'java';
        // Kotlin
        if (/^\s*(fun\s+\w+|val\s+\w+|data\s+class|sealed\s+class)/m.test(c)) return 'kotlin';
        // Swift
        if (/^\s*(import\s+Foundation|import\s+UIKit|guard\s+let|@objc)/m.test(c)) return 'swift';
        // Elixir
        if (/^\s*(defmodule|defp?\s+\w+|pipe_through|\|>)/m.test(c)) return 'elixir';
        // Julia
        if (/^\s*(function\s+\w+|using\s+\w+|mutable\s+struct|@show)/m.test(c)) return 'julia';
        // Scala
        if (/^\s*(object\s+\w+|case\s+class|sealed\s+trait|val\s+\w+:\s*\w+)/m.test(c)) return 'scala';
        // Clojure
        if (/^\s*\((ns|defn|defn-|defmacro|require)\b/m.test(c)) return 'clojure';
        // Nim
        if (/^\s*(proc\s+\w+|import\s+(os|strutils|sequtils))/m.test(c)) return 'nim';
        // C#
        if (/^\s*(using\s+System|namespace\s+\w+|Console\.Write)/m.test(c)) return 'csharp';
        // PHP
        if (/^<\?php|^\s*\$\w+\s*=.*;\s*$/m.test(c)) return 'php';
        // Erlang
        if (/^\s*-module\(|^\s*-export\(|^\s*\w+\(.*\)\s*->/m.test(c)) return 'erlang';
        // Crystal
        if (/^\s*(require\s+".*"|class\s+\w+\s*<)/m.test(c) && /^\s*(puts|pp)\b/m.test(c)) return 'crystal';
        // PowerShell
        if (/^\s*(Import-Module|\$\w+\s*=|Write-Host|param\s*\()/m.test(c)) return 'powershell';
        // Haskell
        if (/^\s*(module\s+\w+|import\s+(qualified\s+)?Data\.|^\w+\s*::\s*)/m.test(c)) return 'haskell';
        // WASM/WAT
        if (/^\s*\(module\b|\(func\s+\$/m.test(c)) return 'wasm';
        // CoffeeScript
        if (/^\s*\w+\s*=\s*\(.*\)\s*[-=]>/m.test(c)) return 'coffeescript';
        // MicroPython
        if (/^\s*(from\s+machine\s+import|import\s+utime)/m.test(c)) return 'micropython';
        // Transcript detection (timestamped spoken-word content)
        if (/^\d{1,2}:\d{2}\n/m.test(c) || /^\[\d{2}:\d{2}(:\d{2})?\]/m.test(c) || /^Speaker\s*\d/m.test(c)) return 'transcript';
        if (/\b(quantum annealing|qubit|hamiltonian|entanglement)\b/i.test(c) && /\b(so|now|and then|okay|um)\b/i.test(c)) return 'transcript';
        // ── New AI/LLM/MCP/Quantum/Hardware/Infra detection ──
        // Modelfile (Ollama)
        if (/^\s*FROM\s+\w/m.test(c) && /^\s*(PARAMETER|SYSTEM|TEMPLATE)\s/m.test(c)) return 'modelfile';
        // QASM
        if (/^\s*OPENQASM\s/m.test(c) || (/^\s*(qreg|creg|qubit)\s/m.test(c) && /^\s*measure\s/m.test(c))) return 'qasm';
        // Quil
        if (/^\s*(DECLARE|DEFGATE|DEFCIRCUIT)\s/m.test(c) && /^\s*(MEASURE|RX|RY|H)\s/m.test(c)) return 'quil';
        // Q#
        if (/^\s*namespace\s+\w+/m.test(c) && /^\s*(operation|open\s+Microsoft\.Quantum)/m.test(c)) return 'qsharp';
        // WGSL
        if (/^\s*@(vertex|fragment|compute|group|binding)\b/m.test(c) || (/^\s*fn\s/m.test(c) && /^\s*(var<|let\s|struct\s)/m.test(c) && /vec[234]|mat[234]|f32|u32/m.test(c))) return 'wgsl';
        // CUDA
        if (/^\s*(__global__|__device__|__host__)\s/m.test(c) || /cudaMalloc|cudaMemcpy|blockIdx|threadIdx/m.test(c)) return 'cuda';
        // OpenCL
        if (/^\s*(__kernel|__global|__local)\s/m.test(c) && /get_global_id/m.test(c)) return 'opencl';
        // Verilog/SystemVerilog
        if (/^\s*module\s+\w+/m.test(c) && /^\s*(wire|reg|input|output|always)\b/m.test(c)) return 'verilog';
        // VHDL
        if (/^\s*(entity|architecture|library\s+ieee)\b/im.test(c)) return 'vhdl';
        // TOML
        if (/^\s*\[[\w.-]+\]\s*$/m.test(c) && /^\s*[\w-]+\s*=\s*/m.test(c) && !/^\s*\{/m.test(c)) return 'toml';
        // Protobuf
        if (/^\s*syntax\s*=\s*"proto[23]"/m.test(c) || (/^\s*message\s+\w+/m.test(c) && /^\s*(repeated|optional|required)\s/m.test(c))) return 'protobuf';
        // GraphQL
        if (/^\s*(type\s+\w+\s*\{|query\s+\w+|mutation\s+\w+|schema\s*\{)/m.test(c)) return 'graphql';
        // Dockerfile
        if (/^\s*FROM\s+\w+/m.test(c) && /^\s*(RUN|CMD|ENTRYPOINT|COPY|WORKDIR)\s/m.test(c)) return 'dockerfile';
        // Terraform/HCL
        if (/^\s*(resource|data|variable|terraform|provider)\s+"?\w+/m.test(c)) return 'terraform';
        // Nginx
        if (/^\s*(server|location|upstream)\s*\{/m.test(c) && /^\s*(listen|server_name|proxy_pass)\s/m.test(c)) return 'nginx';
        // Lua
        if (/^\s*(local\s+)?function\s+\w+\s*\(/m.test(c) && /^\s*(local|require)\s/m.test(c) && !/^\s*def\s/m.test(c)) return 'lua';
        // Ruby
        if (/^#!.*ruby/m.test(c) || (/^\s*(require|require_relative)\s/m.test(c) && /^\s*def\s+\w+/m.test(c) && /^\s*end\b/m.test(c))) return 'ruby';
        // Zig
        if (/^\s*const\s+std\s*=\s*@import\("std"\)/m.test(c) || /^\s*@import\s*\(/m.test(c)) return 'zig';
        // Assembly
        if (/^\s*\.(section|text|data|global|globl)\s/m.test(c) && /^\s*(mov|push|pop|call|ret|jmp)\b/im.test(c)) return 'assembly';
        // Dart
        if (/^\s*import\s+'package:/m.test(c) || (/^\s*(void|Widget|Future)\s+\w+/m.test(c) && /^\s*(var|final|const|late)\s/m.test(c))) return 'dart';
        // Prompt template
        if (/\{\{#?(if|each|unless)\b/m.test(c) || /\{%\s*(if|for|block)\b/m.test(c) || /^\s*\[(system|user|assistant)\]/im.test(c)) return 'prompt';
        // JSON Schema / MCP
        if (/^\s*"inputSchema"/m.test(c) || /^\s*"\$schema"/m.test(c) || (/^\s*"properties"/m.test(c) && /^\s*"type"\s*:\s*"object"/m.test(c))) return 'jsonschema';
        // .qbit codec (prefix-prefixed lines)
        if (/^\s*(n:|\+1:|-n:|\+0:|0:|-1:|\+n:|\+2:|-0:|\+3:|1:)\s/m.test(c)) return 'qbit';
        // Contrails (Unicode concept symbols)
        if (/^[\u2190-\u2194\u21D4\u2229\u222A\u2282\u2283\u2208\u2261\u2295\u2296\u2297\u2299\u22A0\u22A2\u22A4\u22A5\u25A1\u25C7\u25CB\u25CF\u25B6\u25A0\u03C4\u03C3\u03C0\u2A00]\s/m.test(c) || /^[→←↔⇒⊞⊟∀∃⊤⊥⊢∘⊕⊗□◇○●▶■∩∪⊂⊃∈≡τσπ⊙]/m.test(c)) return 'contrail';
        // MDC (Cursor rules)
        if (/^---\s*\n/m.test(c) && /^\s*(alwaysApply|globs|description)\s*:/m.test(c)) return 'mdc';
        // INI
        if (/^\s*\[[\w\s.-]+\]\s*$/m.test(c) && /^\s*[\w.-]+\s*=\s*/m.test(c) && /^\s*[;#]/m.test(c)) return 'ini';
        // Markdown detection
        if (/^\s*#{1,6}\s/.test(c) || /^\s*[-*+]\s/.test(c)) return 'markdown';
        return 'python'; // default
    }

    // Line Classifier
    function classifyLine(line, language) {
        var lineLen = line.length;
        var k = 0;
        while (k < lineLen && line.charCodeAt(k) <= 32) k++;
        if (k >= lineLen) return DEFAULT_RESULT;
        var fc = line.charCodeAt(k);
        if (fc === 125 || fc === 41 || fc === 93 || fc === 59 || fc === 44 ||
            fc === 39 || fc === 96 || fc === 95 || (fc >= 48 && fc <= 57)) return VARIABLE_RESULT;
        var compiled = COMPILED[language || 'python'] || COMPILED_PYTHON;
        for (var _i = 0, _len = compiled.length; _i < _len; _i++) {
            if (compiled[_i][0].test(line)) return compiled[_i][1];
        }
        return VARIABLE_RESULT;
    }

    // Quick classifier (returns just the symbol string — for terminal use)
    function classifyLineSym(line, language) {
        return classifyLine(line, language).sym;
    }

    // Content Prefixing
    function prefixContent(content, language) {
        var lang = language || detectLanguage(content);
        var lines = (content || '').split('\n');
        var len = lines.length;
        var out = new Array(len);
        for (var i = 0; i < len; i++) out[i] = classifyLine(lines[i], lang).sym + ' ' + lines[i];
        return out.join('\n');
    }

    // Prefix Metadata (per-content analysis)
    function prefixMetadata(content, language) {
        var lang = language || detectLanguage(content);
        var lines = (content || '').split('\n');
        var len = lines.length;
        var counts = {};
        var nonBlank = 0;
        var lineData = new Array(len);
        for (var i = 0; i < len; i++) {
            var result = classifyLine(lines[i], lang);
            counts[result.category] = (counts[result.category] || 0) + 1;
            if (result.category !== 'default') nonBlank++;
            lineData[i] = { line: i + 1, sym: result.sym, category: result.category };
        }
        return { language: lang, totalLines: len, classifiedLines: nonBlank, coverage: nonBlank > 0 ? 100 : 100, prefixCounts: counts, lines: lineData };
    }

    // Export Header (for file downloads)
    function exportHeader(meta, source) {
        var countsStr = Object.entries(meta.prefixCounts)
            .map(function (e) { return e[0] + ':' + e[1]; }).join(' · ');
        return '# ⚛ Quantum Prefix Gutter' +
            (source ? ' — ' + source : '') +
            ' — ' + meta.language +
            ' — ' + meta.coverage + '% coverage (' +
            meta.classifiedLines + '/' + meta.totalLines + ' lines)\n' +
            '# Symbols: n: +1: -n: +0: 0: -1: +n: 1: -0:\n' +
            '# ' + countsStr + '\n\n';
    }

    // Export with Prefixes (content + header)
    function exportWithPrefixes(content, language, source) {
        var lang = language || detectLanguage(content);
        var meta = prefixMetadata(content, lang);
        var header = exportHeader(meta, source);
        var prefixed = prefixContent(content, lang);
        return { text: header + prefixed, meta: meta };
    }

    // Download Helper
    function downloadWithPrefixes(content, filename, language, source) {
        var result = exportWithPrefixes(content, language, source);
        var blob = new Blob([result.text], { type: 'text/plain' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
        return result.meta;
    }

    // JSON Export (with prefix metadata baked in)
    function wrapJsonExport(data, contents, source) {
        // contents: array of { content, language? } or a single string
        var items = Array.isArray(contents) ? contents : [{ content: contents }];
        var totalLines = 0, totalClassified = 0, globalCounts = {};

        items.forEach(function (item) {
            var meta = prefixMetadata(item.content || '', item.language);
            totalLines += meta.totalLines;
            totalClassified += meta.classifiedLines;
            for (var cat in meta.prefixCounts) {
                globalCounts[cat] = (globalCounts[cat] || 0) + meta.prefixCounts[cat];
            }
        });

        return Object.assign({}, data, {
            quantumGutter: {
                source: source || 'unknown',
                version: '11-symbol-v2',
                symbols: ['n:', '+1:', '-n:', '+0:', '0:', '-1:', '+n:', '1:', '-0:'],
                totalLines: totalLines,
                classifiedLines: totalClassified,
                coverage: totalLines > 0 ? Math.round((totalClassified / totalLines) * 100) + '%' : '0%',
                prefixCounts: globalCounts,
                timestamp: new Date().toISOString()
            }
        });
    }

    // ANSI gutter line (for terminal rendering)
    function gutterLineAnsi(line, lineNum, language) {
        var result = classifyLine(line, language);
        var col = PREFIX_ANSI[result.sym] || '\x1b[90m';
        var num = String(lineNum).padStart(3);
        return '\x1b[90m' + num + '\x1b[0m ' + col + result.sym.padEnd(3) + '\x1b[0m ' + line;
    }

    // Live Sync — BroadcastChannel
    var _syncChannel = null;
    var _stateListeners = [];
    var _globalState = {};    // source → { coverage, lines, prefixCounts, ... }
    var _iotSocket = null;
    var _iotUrl = null;

    function _ensureChannel() {
        if (_syncChannel) return _syncChannel;
        try {
            _syncChannel = new BroadcastChannel('quantum-prefixes');
            _syncChannel.onmessage = function (e) {
                var msg = e.data;
                if (msg && msg.type === 'qp-state') {
                    _globalState[msg.source] = msg.state;
                    _stateListeners.forEach(function (fn) { fn(msg.source, msg.state, _globalState); });
                    // Relay to IoT bridge if connected
                    _relayToIoT(msg);
                } else if (msg && msg.type === 'qp-request') {
                    // Another app requesting current state — re-broadcast ours
                    _stateListeners.forEach(function (fn) { fn('__request__', null, _globalState); });
                }
            };
        } catch (e) {
            // BroadcastChannel not available (e.g. old browser)
        }
        return _syncChannel;
    }

    /**
     * Broadcast current quantum prefix state for this source app.
     * @param {string} source  App name (e.g. 'hexbench', 'notepad', 'hexterm')
     * @param {object} state   State object { coverage, totalLines, classifiedLines, prefixCounts, ... }
     */
    function broadcastState(source, state) {
        var ch = _ensureChannel();
        var payload = {
            type: 'qp-state',
            source: source,
            state: Object.assign({}, state, { timestamp: Date.now() }),
        };
        if (ch) ch.postMessage(payload);
        // Also persist to localStorage for cold-start recovery
        _globalState[source] = payload.state;
        try {
            localStorage.setItem('quantum-prefixes-state', JSON.stringify(_globalState));
        } catch (e) { /* quota */ }
        // Relay to IoT
        _relayToIoT(payload);
    }

    /**
     * Request all apps to re-broadcast their state.
     */
    function requestStateSync() {
        var ch = _ensureChannel();
        if (ch) ch.postMessage({ type: 'qp-request' });
    }

    /**
     * Register a listener for state changes.
     * @param {function} fn  Called with (source, state, globalState)
     */
    function onStateChange(fn) {
        _stateListeners.push(fn);
        // Deliver current global state immediately
        for (var src in _globalState) {
            fn(src, _globalState[src], _globalState);
        }
    }

    /**
     * Get aggregate global state (all sources combined).
     */
    function getGlobalState() {
        return Object.assign({}, _globalState);
    }

    /**
     * Load last-known state from localStorage (call on init).
     */
    function loadPersistedState() {
        try {
            var raw = localStorage.getItem('quantum-prefixes-state');
            if (raw) _globalState = JSON.parse(raw);
        } catch (e) { /* corrupt */ }
        return Object.assign({}, _globalState);
    }

    // IoT / Quantum Computer Bridge
    /**
     * Connect to an IoT quantum computer bridge via WebSocket.
     * Messages are JSON: { type: 'qp-state', source, state }
     * The bridge can also push commands back.
     * @param {string} url  WebSocket URL (e.g. 'ws://192.168.1.100:9877/quantum')
     * @param {object} opts  { onMessage, onOpen, onClose, onError, reconnect }
     */
    function connectIoT(url, opts) {
        opts = opts || {};
        _iotUrl = url;

        function _connect() {
            try {
                _iotSocket = new WebSocket(url);
                _iotSocket.onopen = function () {
                    // Send full global state on connect
                    _iotSocket.send(JSON.stringify({
                        type: 'qp-init',
                        globalState: _globalState,
                        timestamp: Date.now()
                    }));
                    if (opts.onOpen) opts.onOpen();
                };
                _iotSocket.onmessage = function (e) {
                    try {
                        var msg = JSON.parse(e.data);
                        // Forward IoT commands to BroadcastChannel
                        if (msg.type === 'qp-command') {
                            var ch = _ensureChannel();
                            if (ch) ch.postMessage(msg);
                        }
                        if (opts.onMessage) opts.onMessage(msg);
                    } catch (err) { /* parse error */ }
                };
                _iotSocket.onclose = function () {
                    _iotSocket = null;
                    if (opts.onClose) opts.onClose();
                    if (opts.reconnect !== false) {
                        setTimeout(_connect, 5000);
                    }
                };
                _iotSocket.onerror = function (err) {
                    if (opts.onError) opts.onError(err);
                };
            } catch (e) {
                if (opts.onError) opts.onError(e);
                if (opts.reconnect !== false) {
                    setTimeout(_connect, 5000);
                }
            }
        }

        _connect();
    }

    function _relayToIoT(payload) {
        if (_iotSocket && _iotSocket.readyState === WebSocket.OPEN) {
            try {
                _iotSocket.send(JSON.stringify(payload));
            } catch (e) { /* socket error */ }
        }
    }

    function disconnectIoT() {
        if (_iotSocket) {
            _iotSocket.close();
            _iotSocket = null;
        }
        _iotUrl = null;
    }

    function isIoTConnected() {
        return _iotSocket && _iotSocket.readyState === WebSocket.OPEN;
    }

    // Quantum Circuit Mapping (prefix → qubit topology)

    /**
     * Map prefix classifications to quantum circuit gates.
     * Each prefix symbol maps to a quantum gate operation:
     *   +1 → H (Hadamard)    - superposition / declaration
     *    1 → CNOT            - entanglement / logic branching
     *   -1 → X (Pauli-X)    - bit flip / I/O side effect
     *   +0 → Rz(θ)          - phase rotation / assignment
     *    0 → I (Identity)    - no-op / neutral
     *   -0 → S (Phase)       - phase gate / comment annotation
     *   +n → T (T-gate)      - modifier / flow control
     *    n → SWAP            - import / data movement
     *   -n → M (Measure)     - unknown / collapse
     */
    var QUBIT_GATE_MAP = {
        // 9 core symbols → 9 quantum gates
        '+1:': { gate: 'H',    name: 'Hadamard',  qubits: 1, desc: 'Superposition — declaration creates possibility space' },
        '1:':  { gate: 'CNOT', name: 'CNOT',      qubits: 2, desc: 'Entanglement — logic branches connect states' },
        '-1:': { gate: 'X',    name: 'Pauli-X',   qubits: 1, desc: 'Bit flip — I/O flips classical state' },
        '+0:': { gate: 'Rz',   name: 'Rz(π/4)',   qubits: 1, angle: Math.PI / 4, desc: 'Phase rotation — assignment changes phase' },
        '0:':  { gate: 'I',    name: 'Identity',   qubits: 1, desc: 'Identity — neutral, no transformation' },
        '-0:': { gate: 'S',    name: 'Phase',      qubits: 1, desc: 'Phase gate — comment adds metadata phase' },
        '+n:': { gate: 'T',    name: 'T-gate',     qubits: 1, desc: 'T-gate — modifier precision adjustment' },
        'n:':  { gate: 'SWAP', name: 'SWAP',       qubits: 2, desc: 'SWAP — import moves data between qubits' },
        '-n:': { gate: 'M',    name: 'Measure',    qubits: 1, desc: 'Measurement — unknown collapses superposition' },
        // Extended symbols → additional gates
        '+2:': { gate: 'CZ',   name: 'Ctrl-Z',    qubits: 2, desc: 'Controlled-Z — loop iteration entangles iterations' },
        '+3:': { gate: 'Y',    name: 'Pauli-Y',   qubits: 1, desc: 'Y-rotation — output rotates observable state' },
        '   ': { gate: 'I',    name: 'Identity',   qubits: 1, desc: 'Identity — blank line, no operation' },
    };

    /**
     * Convert classified source code to a quantum circuit description.
     * Returns an array of gate operations that could be sent to a QPU.
     * @param {string} content  Source code
     * @param {string} language  Language hint
     * @returns {{ gates: Array, qubits: number, depth: number, circuit: string }}
     */
    function toQuantumCircuit(content, language) {
        var meta = prefixMetadata(content, language);
        var gates = [];
        var maxQubit = 0;
        var qubitPtr = 0;

        (meta.lines || []).forEach(function(line, idx) {
            var sym = line.sym || '   ';
            var mapping = QUBIT_GATE_MAP[sym] || QUBIT_GATE_MAP['-n:'];
            var gate = {
                step: idx,
                gate: mapping.gate,
                qubit: qubitPtr % 8,  // 8-qubit register
                lineNum: idx + 1,
                symbol: sym,
            };
            if (mapping.angle !== undefined) {
                gate.angle = mapping.angle;
            }
            if (mapping.qubits === 2) {
                gate.target = (qubitPtr + 1) % 8;
            }
            gates.push(gate);
            if (gate.qubit > maxQubit) maxQubit = gate.qubit;
            if (gate.target && gate.target > maxQubit) maxQubit = gate.target;
            // Advance qubit pointer based on nesting depth
            if (sym === '+1:' || sym === '1:' || sym === '+0:') qubitPtr++;
            if (sym === '+n:' || sym === '-n:' || sym === '-0:') qubitPtr = Math.max(0, qubitPtr - 1);
        });

        // Build ASCII circuit diagram
        var numQubits = maxQubit + 1;
        var circuitLines = [];
        for (var q = 0; q < numQubits; q++) {
            var wire = 'q' + q + ': ';
            gates.forEach(function(g) {
                if (g.qubit === q) {
                    wire += '[' + g.gate + ']─';
                } else if (g.target === q) {
                    wire += '─●──';
                } else {
                    wire += '────';
                }
            });
            circuitLines.push(wire);
        }

        return {
            gates: gates,
            qubits: numQubits,
            depth: gates.length,
            circuit: circuitLines.join('\n'),
            gateMap: QUBIT_GATE_MAP,
        };
    }

    /**
     * Send prefix state as qubit mappings to the IoT bridge.
     * @param {string} content Source code
     * @param {string} language Language hint
     */
    function sendToQPU(content, language) {
        if (!isIoTConnected()) return null;
        var circuit = toQuantumCircuit(content, language);
        _relayToIoT({
            type: 'qpu-circuit',
            circuit: circuit,
            timestamp: Date.now(),
        });
        return circuit;
    }

    // Quantum Statevector Simulator (local, up to 12 qubits)

    function _cmul(ar, ai, br, bi) { return [ar*br - ai*bi, ar*bi + ai*br]; }

    var _S2 = 1 / Math.sqrt(2);

    /** Gate matrices: [[a_re,a_im],[b_re,b_im],[c_re,c_im],[d_re,d_im]] */
    var QGATES = {
        h:  [[_S2,0],[_S2,0],[_S2,0],[-_S2,0]],
        x:  [[0,0],[1,0],[1,0],[0,0]],
        y:  [[0,0],[0,-1],[0,1],[0,0]],
        z:  [[1,0],[0,0],[0,0],[-1,0]],
        s:  [[1,0],[0,0],[0,0],[0,1]],
        t:  [[1,0],[0,0],[0,0],[_S2,_S2]],
        id: [[1,0],[0,0],[0,0],[1,0]],
    };
    function rxGate(t) { var c=Math.cos(t/2),s=Math.sin(t/2); return [[c,0],[0,-s],[0,-s],[c,0]]; }
    function ryGate(t) { var c=Math.cos(t/2),s=Math.sin(t/2); return [[c,0],[-s,0],[s,0],[c,0]]; }
    function rzGate(t) { var c=Math.cos(t/2),s=Math.sin(t/2); return [[c,-s],[0,0],[0,0],[c,s]]; }

    /**
     * Statevector quantum simulator.
     * @param {number} n  Number of qubits (max 12)
     */
    function QSim(n) {
        this.n = n;
        this.N = 1 << n;
        this.re = new Float64Array(this.N);
        this.im = new Float64Array(this.N);
        this.re[0] = 1; // |000...0>
    }

    QSim.prototype.gate1 = function(q, m) {
        var bit = 1 << q;
        for (var i = 0; i < this.N; i++) {
            if (i & bit) continue;
            var j = i | bit;
            var jr = this.re[i], ji = this.im[i];
            var kr = this.re[j], ki = this.im[j];
            var a = _cmul(m[0][0], m[0][1], jr, ji);
            var c = _cmul(m[1][0], m[1][1], kr, ki);
            var e = _cmul(m[2][0], m[2][1], jr, ji);
            var g = _cmul(m[3][0], m[3][1], kr, ki);
            this.re[i] = a[0] + c[0]; this.im[i] = a[1] + c[1];
            this.re[j] = e[0] + g[0]; this.im[j] = e[1] + g[1];
        }
    };

    QSim.prototype.cnot = function(ctrl, tgt) {
        var cmask = 1 << ctrl, tmask = 1 << tgt;
        for (var i = 0; i < this.N; i++) {
            if ((i & cmask) && !(i & tmask)) {
                var j = i | tmask;
                var tr = this.re[i], ti = this.im[i];
                this.re[i] = this.re[j]; this.im[i] = this.im[j];
                this.re[j] = tr; this.im[j] = ti;
            }
        }
    };

    QSim.prototype.cz = function(ctrl, tgt) {
        var cmask = 1 << ctrl, tmask = 1 << tgt;
        for (var i = 0; i < this.N; i++) {
            if ((i & cmask) && (i & tmask)) {
                this.re[i] = -this.re[i]; this.im[i] = -this.im[i];
            }
        }
    };

    QSim.prototype.swap = function(q1, q2) {
        var m1 = 1 << q1, m2 = 1 << q2;
        for (var i = 0; i < this.N; i++) {
            if ((i & m1) && !(i & m2)) {
                var j = (i ^ m1) | m2;
                var tr = this.re[i], ti = this.im[i];
                this.re[i] = this.re[j]; this.im[i] = this.im[j];
                this.re[j] = tr; this.im[j] = ti;
            }
        }
    };

    QSim.prototype.measure = function(shots) {
        var probs = new Float64Array(this.N);
        for (var i = 0; i < this.N; i++) probs[i] = this.re[i]*this.re[i] + this.im[i]*this.im[i];
        var counts = {};
        for (var s = 0; s < shots; s++) {
            var r = Math.random(), acc = 0;
            for (var i = 0; i < this.N; i++) {
                acc += probs[i];
                if (r < acc) {
                    var bits = i.toString(2);
                    while (bits.length < this.n) bits = '0' + bits;
                    counts[bits] = (counts[bits] || 0) + 1;
                    break;
                }
            }
        }
        return counts;
    };

    /** Map gate name → QSim operation */
    function _tgt(g, sim) { return g.target !== undefined ? g.target : ((g.qubit + 1) % sim.n); }
    var _GATE_APPLY = {
        'H': function(sim, g) { sim.gate1(g.qubit, QGATES.h); },
        'X': function(sim, g) { sim.gate1(g.qubit, QGATES.x); },
        'Y': function(sim, g) { sim.gate1(g.qubit, QGATES.y); },
        'I': function(sim, g) { /* identity */ },
        'S': function(sim, g) { sim.gate1(g.qubit, QGATES.s); },
        'T': function(sim, g) { sim.gate1(g.qubit, QGATES.t); },
        'Rz': function(sim, g) { sim.gate1(g.qubit, rzGate(g.angle !== undefined ? g.angle : Math.PI / 4)); },
        'Rx': function(sim, g) { sim.gate1(g.qubit, rxGate(g.angle !== undefined ? g.angle : Math.PI / 4)); },
        'Ry': function(sim, g) { sim.gate1(g.qubit, ryGate(g.angle !== undefined ? g.angle : Math.PI / 4)); },
        'CNOT': function(sim, g) { sim.cnot(g.qubit, _tgt(g, sim)); },
        'CZ': function(sim, g) { sim.cz(g.qubit, _tgt(g, sim)); },
        'SWAP': function(sim, g) { sim.swap(g.qubit, _tgt(g, sim)); },
        'M': function(sim, g) { /* measurement at end */ },
    };

    /**
     * Simulate a quantum circuit from classified source code.
     * @param {string} content  Source code
     * @param {string} language  Language hint
     * @param {number} [shots]  Number of measurement shots (default 1024)
     * @returns {{ counts: Object, circuit: Object, qubits: number }}
     */
    function simulateCircuit(content, language, shots) {
        shots = shots || 1024;
        var circuit = toQuantumCircuit(content, language);
        var n = Math.min(circuit.qubits, 12);
        if (n < 1) n = 1;
        var sim = new QSim(n);
        circuit.gates.forEach(function(g) {
            var apply = _GATE_APPLY[g.gate];
            if (apply) apply(sim, g);
        });
        var counts = sim.measure(shots);
        return { counts: counts, circuit: circuit, qubits: n };
    }

    /**
     * Submit a circuit to IBM Quantum hardware via REST API.
     * Updated for IBM Quantum Platform V2 (2025+): quantum.cloud.ibm.com
     * Free tier: 10 min/month on 100+ qubit QPUs.
     *
     * Authentication flow:
     *   1. API key → exchange for IAM bearer token (1hr expiry)
     *   2. Bearer token + Service-CRN → submit job
     *
     * @param {Object} circuit  Circuit from toQuantumCircuit()
     * @param {string} apiKey   IBM Cloud API key (44 chars)
     * @param {string} [backend] Backend name (default 'ibm_brisbane')
     * @param {number} [shots]   Measurement shots (default 4096)
     * @param {Object} [opts]    { crn: 'crn:v1:...' , region: 'us-east' }
     * @returns {Promise<Object>} Measurement counts
     */
    function submitToIBM(circuit, apiKey, backend, shots, opts) {
        backend = backend || 'ibm_brisbane';
        shots = shots || 4096;
        opts = opts || {};
        var region = opts.region || 'us-east';
        var crn = opts.crn || localStorage.getItem('ibm-quantum-crn') || '';
        var baseUrl = 'https://' + region + '.quantum-computing.cloud.ibm.com';
        var iamUrl = 'https://iam.cloud.ibm.com/identity/token';

        // Step 1: Exchange API key for IAM bearer token
        function getToken() {
            var cached = sessionStorage.getItem('ibm-iam-token');
            var expiry = parseInt(sessionStorage.getItem('ibm-iam-expiry') || '0');
            if (cached && Date.now() < expiry) return Promise.resolve(cached);

            return fetch(iamUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: 'grant_type=urn:ibm:params:oauth:grant-type:apikey&apikey=' + encodeURIComponent(apiKey)
            }).then(function(r) {
                if (!r.ok) return r.text().then(function(t) { throw new Error('IAM auth failed (' + r.status + '): ' + t); });
                return r.json();
            }).then(function(data) {
                sessionStorage.setItem('ibm-iam-token', data.access_token);
                sessionStorage.setItem('ibm-iam-expiry', String(Date.now() + (data.expires_in - 60) * 1000));
                return data.access_token;
            });
        }

        // Step 2: Build QASM 2.0 from circuit gates
        var n = circuit.qubits;
        var qasm = 'OPENQASM 2.0;\ninclude "qelib1.inc";\nqreg q[' + n + '];\ncreg c[' + n + '];\n\n';
        circuit.gates.forEach(function(g) {
            if (g.gate === 'CNOT') qasm += 'cx q[' + g.qubit + '],q[' + (g.target || 0) + '];\n';
            else if (g.gate === 'CZ') qasm += 'cz q[' + g.qubit + '],q[' + (g.target || 0) + '];\n';
            else if (g.gate === 'SWAP') qasm += 'swap q[' + g.qubit + '],q[' + (g.target || 0) + '];\n';
            else if (g.gate === 'Rz') qasm += 'rz(' + (Math.PI/4).toFixed(4) + ') q[' + g.qubit + '];\n';
            else if (g.gate === 'H') qasm += 'h q[' + g.qubit + '];\n';
            else if (g.gate === 'X') qasm += 'x q[' + g.qubit + '];\n';
            else if (g.gate === 'Y') qasm += 'y q[' + g.qubit + '];\n';
            else if (g.gate === 'S') qasm += 's q[' + g.qubit + '];\n';
            else if (g.gate === 'T') qasm += 't q[' + g.qubit + '];\n';
        });
        qasm += '\nmeasure q -> c;\n';

        // Step 3: Submit job with V2 headers
        return getToken().then(function(bearerToken) {
            var headers = {
                'Authorization': 'Bearer ' + bearerToken,
                'Content-Type': 'application/json'
            };
            if (crn) headers['Service-CRN'] = crn;

            return fetch(baseUrl + '/v1/jobs', {
                method: 'POST', headers: headers,
                body: JSON.stringify({
                    program_id: 'sampler',
                    backend: backend,
                    params: {
                        pubs: [[qasm, {}, shots]]
                    }
                })
            });
        }).then(function(res) {
            if (!res.ok) return res.text().then(function(t) { throw new Error('IBM API ' + res.status + ': ' + t); });
            return res.json();
        }).then(function(job) {
            var jobId = job.id || job.job_id;
            // Step 4: Poll for results
            return getToken().then(function(bearerToken) {
                var headers = { 'Authorization': 'Bearer ' + bearerToken };
                if (crn) headers['Service-CRN'] = crn;

                function poll(attempt) {
                    if (attempt > 120) throw new Error('Job timed out after 10 min');
                    return new Promise(function(resolve) { setTimeout(resolve, 5000); })
                        .then(function() { return fetch(baseUrl + '/v1/jobs/' + jobId, { headers: headers }); })
                        .then(function(r) { return r.json(); })
                        .then(function(data) {
                            var st = (data.status || data.state || '').toUpperCase();
                            if (st === 'COMPLETED') {
                                return fetch(baseUrl + '/v1/jobs/' + jobId + '/results', { headers: headers })
                                    .then(function(r) { return r.json(); })
                                    .then(function(rd) {
                                        // Handle V2 result format (PUBs) or V1 fallback
                                        if (rd.results && rd.results[0]) {
                                            var r0 = rd.results[0];
                                            return r0.data ? (r0.data.counts || r0.data) : r0;
                                        }
                                        return rd;
                                    });
                            }
                            if (st === 'FAILED' || st === 'CANCELLED') throw new Error('Job ' + st + (data.error ? ': ' + JSON.stringify(data.error) : ''));
                            return poll(attempt + 1);
                        });
                }
                return poll(0);
            });
        });
    }

    /**
     * Compute Hellinger fidelity between two count distributions.
     * Returns 0 (completely different) to 1 (identical).
     * @param {Object} countsA  Measurement counts from simulator
     * @param {Object} countsB  Measurement counts from QPU
     * @returns {number} Fidelity score 0-1
     */
    function hellingerFidelity(countsA, countsB) {
        var allKeys = {};
        var totalA = 0, totalB = 0;
        for (var k in countsA) { allKeys[k] = 1; totalA += countsA[k]; }
        for (var k in countsB) { allKeys[k] = 1; totalB += countsB[k]; }
        if (totalA === 0 || totalB === 0) return 0;
        var sum = 0;
        for (var k in allKeys) {
            var pA = (countsA[k] || 0) / totalA;
            var pB = (countsB[k] || 0) / totalB;
            sum += Math.sqrt(pA * pB);
        }
        return sum * sum; // Fidelity = (sum of sqrt(p*q))^2
    }

    // Aggregate Stats Helper
    function aggregateGlobalStats() {
        var totalLines = 0, totalClassified = 0, counts = {}, sources = [];
        for (var src in _globalState) {
            var s = _globalState[src];
            if (!s) continue;
            sources.push(src);
            totalLines += (s.totalLines || 0);
            totalClassified += (s.classifiedLines || 0);
            if (s.prefixCounts) {
                for (var cat in s.prefixCounts) {
                    counts[cat] = (counts[cat] || 0) + s.prefixCounts[cat];
                }
            }
        }
        return {
            sources: sources,
            totalLines: totalLines,
            classifiedLines: totalClassified,
            coverage: totalLines > 0 ? Math.round((totalClassified / totalLines) * 100) : 0,
            prefixCounts: counts
        };
    }

    // Theme Engine — Light / Dark mode for all apps
    var THEMES = {
        dark: {
            '--qp-bg':           '#0d1117',
            '--qp-bg-secondary': '#161b22',
            '--qp-bg-tertiary':  '#21262d',
            '--qp-bg-hover':     '#292e36',
            '--qp-border':       '#30363d',
            '--qp-border-muted': '#21262d',
            '--qp-text':         '#e6edf3',
            '--qp-text-secondary': '#c9d1d9',
            '--qp-text-muted':   '#8b949e',
            '--qp-accent':       '#58a6ff',
            '--qp-accent-subtle':'rgba(56,139,253,0.15)',
            '--qp-shadow':       'rgba(0,0,0,0.3)',
            '--qp-card':         '#161b22',
            '--qp-card-border':  '#21262d',
            '--qp-input-bg':     '#0d1117',
            '--qp-canvas-bg':    '#0d1117',
            '--qp-code-bg':      '#161b22',
            '--qp-scrollbar':    '#30363d',
            '--qp-scrollbar-track': '#0d1117',
        },
        light: {
            '--qp-bg':           '#ffffff',
            '--qp-bg-secondary': '#f6f8fa',
            '--qp-bg-tertiary':  '#eaeef2',
            '--qp-bg-hover':     '#e2e6ea',
            '--qp-border':       '#d0d7de',
            '--qp-border-muted': '#d8dee4',
            '--qp-text':         '#1f2328',
            '--qp-text-secondary': '#424a53',
            '--qp-text-muted':   '#656d76',
            '--qp-accent':       '#0969da',
            '--qp-accent-subtle':'rgba(9,105,218,0.1)',
            '--qp-shadow':       'rgba(31,35,40,0.12)',
            '--qp-card':         '#ffffff',
            '--qp-card-border':  '#d0d7de',
            '--qp-input-bg':     '#f6f8fa',
            '--qp-canvas-bg':    '#f6f8fa',
            '--qp-code-bg':      '#f6f8fa',
            '--qp-scrollbar':    '#c1c8cd',
            '--qp-scrollbar-track': '#f6f8fa',
        }
    };

    var _currentTheme = 'dark';
    var _themeStyleEl = null;
    var _themeToggleEl = null;
    var _themeChannel = null;
    var _themeListeners = [];

    function _ensureThemeChannel() {
        if (_themeChannel) return _themeChannel;
        try {
            _themeChannel = new BroadcastChannel('qp-theme');
            _themeChannel.onmessage = function(e) {
                if (e.data && e.data.type === 'qp-theme-change' && e.data.theme !== _currentTheme) {
                    _applyTheme(e.data.theme, true);
                }
            };
        } catch(e) {}
        return _themeChannel;
    }

    function _applyTheme(theme, fromBroadcast) {
        _currentTheme = theme;
        var vars = THEMES[theme] || THEMES.dark;

        // Set CSS custom properties on :root
        var root = document.documentElement;
        for (var key in vars) { root.style.setProperty(key, vars[key]); }

        // Set data attribute for CSS selectors
        root.setAttribute('data-theme', theme);

        // Inject override stylesheet that maps hardcoded dark colors → variables
        if (!_themeStyleEl && typeof document !== 'undefined') {
            _themeStyleEl = document.createElement('style');
            _themeStyleEl.id = 'qp-theme-overrides';
            document.head.appendChild(_themeStyleEl);
        }

        if (_themeStyleEl) {
            // This CSS overrides hardcoded colors with theme variables.
            // Pages that already use --cursor-* get mapped too.
            _themeStyleEl.textContent = theme === 'light' ? [
                ':root {',
                '  --cursor-bg: var(--qp-bg); --cursor-bg-secondary: var(--qp-bg-secondary);',
                '  --cursor-bg-tertiary: var(--qp-bg-tertiary); --cursor-bg-hover: var(--qp-bg-hover);',
                '  --cursor-border: var(--qp-border); --cursor-border-muted: var(--qp-border-muted);',
                '  --cursor-text: var(--qp-text); --cursor-text-secondary: var(--qp-text-secondary);',
                '  --cursor-text-muted: var(--qp-text-muted); --cursor-accent: var(--qp-accent);',
                '  --cursor-accent-subtle: var(--qp-accent-subtle); --cursor-shadow: var(--qp-shadow);',
                '  --bg: var(--qp-bg); --bg2: var(--qp-bg-secondary); --bg3: var(--qp-bg-tertiary);',
                '  --border: var(--qp-border); --text: var(--qp-text); --text-m: var(--qp-text-muted);',
                '  --muted: var(--qp-text-muted);',
                '  color-scheme: light;',
                '}',
                'body { background: var(--qp-bg) !important; color: var(--qp-text) !important; }',
                '::-webkit-scrollbar-thumb { background: var(--qp-scrollbar) !important; }',
                '::-webkit-scrollbar-track { background: var(--qp-scrollbar-track) !important; }',
                // Map common hardcoded dark backgrounds
                '[style*="background:#0d1117"], [style*="background: #0d1117"] { background: var(--qp-bg) !important; }',
                '[style*="background:#161b22"], [style*="background: #161b22"] { background: var(--qp-bg-secondary) !important; }',
                '[style*="background:#21262d"], [style*="background: #21262d"] { background: var(--qp-bg-tertiary) !important; }',
                '[style*="color:#e6edf3"], [style*="color: #e6edf3"] { color: var(--qp-text) !important; }',
                '[style*="color:#c9d1d9"], [style*="color: #c9d1d9"] { color: var(--qp-text-secondary) !important; }',
                '[style*="color:#8b949e"], [style*="color: #8b949e"] { color: var(--qp-text-muted) !important; }',
                '[style*="border-color:#30363d"], [style*="border-color: #30363d"] { border-color: var(--qp-border) !important; }',
                // Common element overrides
                'input, textarea, select { background: var(--qp-input-bg) !important; color: var(--qp-text) !important; border-color: var(--qp-border) !important; }',
                'code { background: var(--qp-code-bg) !important; }',
                'pre { background: var(--qp-code-bg) !important; }',
                '.hero, .cta { background: var(--qp-bg-secondary) !important; }',
                'canvas { border-color: var(--qp-border) !important; }',
                // Quantum nav cube — light mode needs opaque-ish backgrounds for 3D faces
                '.nav-cube-face { background: rgba(240,242,245,0.92) !important; border-color: var(--qp-border) !important; }',
                '.nav-cube-face span { background: rgba(220,225,230,0.8) !important; color: var(--qp-text-muted) !important; }',
                '.nav-cube-face span:hover { color: var(--qp-text) !important; }',
                '.nav-cube-face span.ncf-active { color: #fff !important; }',
                '.nav-cube-arrow { background: var(--qp-bg-tertiary) !important; color: var(--qp-text-muted) !important; border-color: var(--qp-border) !important; }',
                '.ncv-controls { border-top-color: var(--qp-border) !important; }',
                // Sidebar panels — ensure backgrounds are not too white in light mode
                '.sidebar-tabs-ext { background: var(--qp-bg-tertiary) !important; }',
                '.sidebar-tab-ext-panel { background: var(--qp-bg) !important; }',
                '.gpuq-mini-card { background: var(--qp-bg-tertiary) !important; border-color: var(--qp-border) !important; }',
                '.gpuq-mini-label { border-top-color: var(--qp-border-muted, var(--qp-border)) !important; }',
                '.chat-msg { background: var(--qp-bg-tertiary) !important; }',
                '.chat-msg.sys { background: none !important; }',
                '.chat-link-bar { background: var(--qp-bg-tertiary) !important; }',
                '.layer-btn { background: var(--qp-bg-tertiary) !important; border-color: var(--qp-border) !important; }',
                '.blocks-panel, .lang-panel, .llm-panel, .gpuq-panel { background: var(--qp-bg) !important; }',
                // kBatch panels
                '.lkb-panel { background: var(--qp-bg) !important; }',
            ].join('\n') : [
                ':root {',
                '  --cursor-bg: var(--qp-bg); --cursor-bg-secondary: var(--qp-bg-secondary);',
                '  --cursor-bg-tertiary: var(--qp-bg-tertiary); --cursor-bg-hover: var(--qp-bg-hover);',
                '  --cursor-border: var(--qp-border); --cursor-border-muted: var(--qp-border-muted);',
                '  --cursor-text: var(--qp-text); --cursor-text-secondary: var(--qp-text-secondary);',
                '  --cursor-text-muted: var(--qp-text-muted); --cursor-accent: var(--qp-accent);',
                '  --cursor-accent-subtle: var(--qp-accent-subtle); --cursor-shadow: var(--qp-shadow);',
                '  --bg: var(--qp-bg); --bg2: var(--qp-bg-secondary); --bg3: var(--qp-bg-tertiary);',
                '  --border: var(--qp-border); --text: var(--qp-text); --text-m: var(--qp-text-muted);',
                '  --muted: var(--qp-text-muted);',
                '  color-scheme: dark;',
                '}',
            ].join('\n');
        }

        // Update toggle button appearance — highlight active side
        try {
            var sunEl = document.getElementById('qp-theme-sun');
            var moonEl = document.getElementById('qp-theme-moon');
            if (sunEl && moonEl) {
                sunEl.style.background = theme === 'light' ? 'var(--qp-accent-subtle, rgba(88,166,255,0.15))' : 'none';
                sunEl.style.color = theme === 'light' ? 'var(--qp-accent, #58a6ff)' : 'var(--qp-text-muted, #8b949e)';
                moonEl.style.background = theme === 'dark' ? 'var(--qp-accent-subtle, rgba(88,166,255,0.15))' : 'none';
                moonEl.style.color = theme === 'dark' ? 'var(--qp-accent, #58a6ff)' : 'var(--qp-text-muted, #8b949e)';
            }
        } catch(e) {}

        // Persist
        try { localStorage.setItem('qp-theme', theme); } catch(e) {}

        // Broadcast to other tabs
        if (!fromBroadcast) {
            var ch = _ensureThemeChannel();
            if (ch) ch.postMessage({ type: 'qp-theme-change', theme: theme });
        }

        // Notify listeners
        _themeListeners.forEach(function(fn) { fn(theme); });
    }

    function toggleTheme() {
        try { localStorage.setItem('qp-theme-override', 'yes'); } catch(e) {}
        _applyTheme(_currentTheme === 'dark' ? 'light' : 'dark');
    }

    function setTheme(theme) {
        if (theme === 'dark' || theme === 'light') _applyTheme(theme);
    }

    function getTheme() { return _currentTheme; }

    function onThemeChange(fn) { _themeListeners.push(fn); }

    function _initTheme() {
        if (typeof document === 'undefined') return;
        try {
            // Determine if user has manually overridden, or if we auto-detect
            var userOverride = null;
            try { userOverride = localStorage.getItem('qp-theme-override'); } catch(e) {}
            var saved = null;
            try { saved = localStorage.getItem('qp-theme'); } catch(e) {}

            var systemPref = 'dark';
            try {
                if (root.matchMedia && root.matchMedia('(prefers-color-scheme: light)').matches) systemPref = 'light';
            } catch(e) {}

            // If user has a manual override, use it; otherwise follow system
            var initial = (userOverride === 'yes' && saved) ? saved : systemPref;

            // In iframe (e.g. hub): no toggle — hub holds it; listen for qp-theme broadcasts.
            // uvqbit stands on its own — skip entirely so it keeps its own toggle and theme logic.
            var inIframe = (typeof window !== 'undefined' && window !== window.top);
            var isUvqbit = inIframe && /uvqbit\.html/.test((window.location.pathname || '') + (window.location.href || ''));
            if (isUvqbit) return; // uvqbit: own toggle, own theme
            if (inIframe) {
                _ensureThemeChannel();
                _applyTheme(initial);
                return; // other iframes: listen for hub, no toggle
            }
            // Hub + hub child pages: no QP toggle — hub uses .hub-theme-toggle; children lean on hub lighting
            var path = (window.location.pathname || '').toLowerCase();
            var hubChildren = ['ugrad-ai.html','qbit-map.html','qbit-globe.html','history.html','search.html','launcher.html','qbit-prefix-atlas.html','uterm.html','qbit-core-race.html','qbit-globe-earth.html'];
            if (hubChildren.some(function(p){ return path.indexOf(p) !== -1; })) {
                _ensureThemeChannel();
                _applyTheme(initial);
                return;
            }

            // Global policy: disable built-in side-by-side ☀ ☾ toggle everywhere.
            // Pages can provide their own single-button control if needed.
            var existingToggle = document.getElementById('qp-theme-toggle');
            if (existingToggle && existingToggle.parentNode) existingToggle.parentNode.removeChild(existingToggle);
            _ensureThemeChannel();
            _applyTheme(initial);
            return;

            // Create side-by-side ☀ ☾ toggle — top-right, no circle
            _themeToggleEl = document.createElement('div');
            _themeToggleEl.id = 'qp-theme-toggle';
            var s = _themeToggleEl.style;
            s.position = 'fixed'; s.top = '8px'; s.right = '12px'; s.zIndex = '99999';
            s.display = 'flex'; s.alignItems = 'center'; s.gap = '0';
            s.borderRadius = '6px'; s.overflow = 'hidden';
            s.border = '1px solid var(--qp-border, #30363d)';
            s.background = 'var(--qp-bg-secondary, #161b22)';
            s.boxShadow = '0 1px 4px var(--qp-shadow, rgba(0,0,0,0.2))';
            s.fontFamily = 'system-ui, sans-serif'; s.lineHeight = '1';
            s.userSelect = 'none'; s.webkitUserSelect = 'none';

            // Sun button (light)
            var sunBtn = document.createElement('button');
            sunBtn.id = 'qp-theme-sun';
            sunBtn.textContent = '☀';
            sunBtn.title = 'Light mode';
            _styleThemeBtn(sunBtn);

            // Moon button (dark)
            var moonBtn = document.createElement('button');
            moonBtn.id = 'qp-theme-moon';
            moonBtn.textContent = '☾';
            moonBtn.title = 'Dark mode';
            _styleThemeBtn(moonBtn);

            sunBtn.addEventListener('click', function() {
                try { localStorage.setItem('qp-theme-override', 'yes'); } catch(e) {}
                _applyTheme('light');
            });
            moonBtn.addEventListener('click', function() {
                try { localStorage.setItem('qp-theme-override', 'yes'); } catch(e) {}
                _applyTheme('dark');
            });

            _themeToggleEl.appendChild(sunBtn);
            _themeToggleEl.appendChild(moonBtn);
            var _host = document.querySelector('[data-qp-theme-host]');
            if (_host) {
                s.position = 'static'; s.top = ''; s.right = '';
                s.zIndex = ''; s.boxShadow = 'none';
                _host.appendChild(_themeToggleEl);
            } else {
                document.body.appendChild(_themeToggleEl);
            }

            _ensureThemeChannel();
            _applyTheme(initial);

            // Auto-detect system preference changes — apply unless user has overridden
            if (root.matchMedia) {
                try {
                    root.matchMedia('(prefers-color-scheme: light)').addEventListener('change', function(e) {
                        try {
                            var override = localStorage.getItem('qp-theme-override');
                            if (override !== 'yes') {
                                _applyTheme(e.matches ? 'light' : 'dark');
                            }
                        } catch(ex) {}
                    });
                } catch(e) {}
            }
        } catch(err) {
            // Failsafe — never crash the page over theme init
            if (typeof console !== 'undefined') console.warn('QP theme init error:', err);
        }
    }

    function _styleThemeBtn(btn) {
        var s = btn.style;
        s.background = 'none'; s.border = 'none'; s.padding = '4px 10px';
        s.fontSize = '14px'; s.cursor = 'pointer'; s.color = 'var(--qp-text-muted, #8b949e)';
        s.transition = 'all 0.15s ease'; s.lineHeight = '1'; s.borderRadius = '0';
        s.outline = 'none'; s.display = 'flex'; s.alignItems = 'center'; s.justifyContent = 'center';
    }

    // Auto-init
    loadPersistedState();
    _ensureChannel();

    // Init theme when DOM is ready
    if (typeof document !== 'undefined') {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', _initTheme);
        } else {
            _initTheme();
        }
    }

    // 3D Quantum Coordinate Mapping
    /**
     * Map document/context analysis to 3D quantum coordinates [x, y, z].
     * x = sub-reference density (0-1) → deps dimension
     * y = word complexity / vocabulary richness (0-1) → lines dimension
     * z = tone complexity / multi-dimensionality (0-1) → complexity dimension
     *
     * @param {Object} analysis - Output from HistorySearch.analyzeContext() or similar
     * @returns {Object} { coordinates: [x, y, z], label, color, gate }
     */
    function contextToCoordinates(analysis) {
        if (!analysis) return { coordinates: [0, 0, 0], label: 'origin', color: '#64748b', gate: 'id' };

        // x: sub-reference density (links, dates, quotes, monetary signals)
        var refCount = 0;
        if (analysis.subReferences) {
            for (var key in analysis.subReferences) {
                refCount += (analysis.subReferences[key] || []).length;
            }
        }
        refCount += (analysis.monetarySignals || []).length;
        var x = Math.min(1, refCount / 50); // normalized 0-1

        // y: vocabulary richness (type-token ratio + hapax ratio + avg word length)
        var ttr = analysis.vocabulary ? analysis.vocabulary.typeTokenRatio : 0;
        var hapax = analysis.vocabulary ? analysis.vocabulary.hapaxRatio : 0;
        var avgLen = analysis.vocabulary ? (analysis.vocabulary.avgWordLength || 5) / 12 : 0;
        var y = Math.min(1, (ttr * 0.4 + hapax * 0.3 + avgLen * 0.3));

        // z: tone complexity (how many tones are active + entropy)
        var activeTones = 0;
        var toneEntropy = 0;
        if (analysis.tone) {
            var toneVals = ['academic', 'marketing', 'educational', 'narrative', 'legal', 'crisis'];
            var toneSum = 0;
            toneVals.forEach(function(t) { if (analysis.tone[t] > 5) activeTones++; toneSum += (analysis.tone[t] || 0); });
            if (toneSum > 0) {
                toneVals.forEach(function(t) {
                    var p = (analysis.tone[t] || 0) / toneSum;
                    if (p > 0) toneEntropy -= p * Math.log2(p);
                });
            }
        }
        var z = Math.min(1, (activeTones / 6) * 0.5 + (toneEntropy / 2.585) * 0.5); // max entropy for 6 = 2.585

        // Map to quantum prefix based on dominant quadrant
        var label, color, gate;
        if (x > 0.6 && z > 0.6) { label = 'complex-referenced'; color = '#8b5cf6'; gate = 'h'; }
        else if (x > 0.6) { label = 'reference-heavy'; color = '#3b82f6'; gate = 'cnot'; }
        else if (z > 0.6) { label = 'tone-complex'; color = '#f97316'; gate = 'rz'; }
        else if (y > 0.6) { label = 'vocabulary-rich'; color = '#34d399'; gate = 't'; }
        else if (analysis.heartbeat !== undefined && analysis.heartbeat > 0.7) { label = 'humanity-centered'; color = '#a78bfa'; gate = 's'; }
        else if (analysis.heartbeat !== undefined && analysis.heartbeat < 0.3) { label = 'profit-oriented'; color = '#ef4444'; gate = 'x'; }
        else { label = 'balanced'; color = '#22d3ee'; gate = 'id'; }

        return {
            coordinates: [Math.round(x * 1000) / 1000, Math.round(y * 1000) / 1000, Math.round(z * 1000) / 1000],
            label: label,
            color: color,
            gate: gate,
            raw: { refDensity: x, vocabRichness: y, toneComplexity: z, activeTones: activeTones, toneEntropy: Math.round(toneEntropy * 100) / 100 },
        };
    }

    // PWA Manifest Generator
    /**
     * Generate a PWA manifest JSON for any uvspeed app.
     * @param {Object} opts - { name, shortName, description, startUrl, themeColor, bgColor, icon192, icon512 }
     * @returns {string} JSON manifest string
     */
    function generateManifest(opts) {
        opts = opts || {};
        return JSON.stringify({
            name: opts.name || 'uvspeed',
            short_name: opts.shortName || opts.name || 'uvspeed',
            description: opts.description || 'beyondBINARY quantum-prefixed application',
            start_url: opts.startUrl || './',
            display: 'standalone',
            orientation: 'any',
            theme_color: opts.themeColor || '#0d1117',
            background_color: opts.bgColor || '#0d1117',
            icons: [
                { src: opts.icon192 || '../icons/icon-192.png', sizes: '192x192', type: 'image/png' },
                { src: opts.icon512 || '../icons/hexterm-512.png', sizes: '512x512', type: 'image/png' },
            ],
        }, null, 2);
    }

    /**
     * Export any app page as a standalone PWA HTML file.
     * @param {Object} opts - { title, content (HTML body), css, js, manifest }
     * @returns {string} Complete HTML string ready to download
     */
    function exportAppAsPWA(opts) {
        opts = opts || {};
        var manifest = opts.manifest || generateManifest({ name: opts.title || 'uvspeed app' });
        var manifestDataUri = 'data:application/json;base64,' + btoa(manifest);
        return '<!DOCTYPE html>\n<html lang="en">\n<head>\n' +
            '<meta charset="UTF-8">\n<meta name="viewport" content="width=device-width,initial-scale=1.0">\n' +
            '<meta name="theme-color" content="#0d1117">\n' +
            '<meta name="apple-mobile-web-app-capable" content="yes">\n' +
            '<link rel="manifest" href="' + manifestDataUri + '">\n' +
            '<title>' + (opts.title || 'uvspeed') + '</title>\n' +
            (opts.css ? '<style>' + opts.css + '</style>\n' : '') +
            '</head>\n<body>\n' +
            (opts.content || '') + '\n' +
            (opts.js ? '<script>' + opts.js + '<\/script>\n' : '') +
            '<script>if("serviceWorker" in navigator)navigator.serviceWorker.register("sw.js").catch(function(){});<\/script>\n' +
            '</body>\n</html>';
    }

    // Public API
    var API = {
        // Constants
        PREFIXES: PREFIXES,
        PREFIX_ANSI: PREFIX_ANSI,
        LANG_PATTERNS: LANG_PATTERNS,
        VERSION: '11-symbol-v3-61lang',

        // Core
        detectLanguage: detectLanguage,
        classifyLine: classifyLine,
        classifyLineSym: classifyLineSym,

        // Content operations
        prefixContent: prefixContent,
        prefixMetadata: prefixMetadata,
        exportHeader: exportHeader,
        exportWithPrefixes: exportWithPrefixes,
        downloadWithPrefixes: downloadWithPrefixes,
        wrapJsonExport: wrapJsonExport,
        gutterLineAnsi: gutterLineAnsi,

        // Live sync
        broadcastState: broadcastState,
        requestStateSync: requestStateSync,
        onStateChange: onStateChange,
        getGlobalState: getGlobalState,
        loadPersistedState: loadPersistedState,
        aggregateGlobalStats: aggregateGlobalStats,

        // IoT / Quantum bridge
        connectIoT: connectIoT,
        disconnectIoT: disconnectIoT,
        isIoTConnected: isIoTConnected,
        toQuantumCircuit: toQuantumCircuit,
        sendToQPU: sendToQPU,
        QUBIT_GATE_MAP: QUBIT_GATE_MAP,

        // QPU execution (local simulator + IBM Quantum)
        QSim: QSim,
        QGATES: QGATES,
        rxGate: rxGate,
        ryGate: ryGate,
        rzGate: rzGate,
        simulateCircuit: simulateCircuit,
        submitToIBM: submitToIBM,
        hellingerFidelity: hellingerFidelity,

        // 3D context mapping
        contextToCoordinates: contextToCoordinates,

        // PWA
        generateManifest: generateManifest,
        exportAppAsPWA: exportAppAsPWA,

        // Theme
        toggleTheme: toggleTheme,
        setTheme: setTheme,
        getTheme: getTheme,
        onThemeChange: onThemeChange,
        THEMES: THEMES,
    };

    // Expose globally
    root.QuantumPrefixes = API;

    // Also expose as module if available
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = API;
    }

})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
