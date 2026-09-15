# Project Ground Rules

## Rule 10: Rigorous End-of-Step Self-Testing
At the end of every step, before reporting back to the user, self-test everything built:
- Click through every button, run every function, submit every form (both valid + invalid/boundary data).
- Check for console/runtime errors, API failures, and network edge cases.
- Verify real outcomes with automated integration scripts or live browser interactions.
- Never declare "done" without explicit, empirical test verification.

## Rule 11: Transparent Bug Reporting & Scope Fidelity
If a bug is found during self-testing:
- Do NOT silently fix it in a way that changes scope, removes a feature, or alters requested behavior.
- Tell the user exactly what is broken and the proposed fix, and ask permission before applying it.
- Exception: Trivial, zero-behavior-change fixes (such as typos or syntax adjustments) may be applied directly, but MUST be explicitly highlighted in the report.
