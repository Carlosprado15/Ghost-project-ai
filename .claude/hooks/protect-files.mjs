#!/usr/bin/env node
/**
 * PreToolUse hook (Edit|Write) — requires live confirmation before touching
 * Ghost Project's protected surface: the live store component, the product
 * catalog, the Shopify theme integration, and the original (non-normalized)
 * GLB source files. See CLAUDE.md / collaboration protocol.
 *
 * Reads the tool call JSON from stdin, prints a permissionDecision JSON to
 * stdout when the target path is protected, prints nothing otherwise (no
 * output = no effect, tool proceeds through the normal permission flow).
 */

let data = '';
process.stdin.on('data', (c) => { data += c; });
process.stdin.on('end', () => {
  let input;
  try {
    input = JSON.parse(data);
  } catch {
    return; // malformed input — fail open, don't block on a parsing bug
  }

  const raw = input?.tool_input?.file_path ?? '';
  const path = raw.replace(/\\/g, '/'); // normalize Windows backslashes

  const protectedPatterns = [
    /\/src\/App_FINAL\.jsx$/,
    /\/src\/data\/products\.json$/,
    /\/shopify\//,
  ];
  const isNormalizedGlb = /\/public\/models\/normalized\//.test(path);
  const isOriginalGlb = !isNormalizedGlb && /\/public\/models\/[^/]+\.glb$/.test(path);

  const isProtected = protectedPatterns.some((r) => r.test(path)) || isOriginalGlb;

  if (isProtected) {
    console.log(JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'ask',
        permissionDecisionReason:
          'Arquivo protegido do Ghost Project (loja ao vivo / catálogo / Shopify / GLB original) — confirme explicitamente antes de alterar.',
      },
    }));
  }
});
