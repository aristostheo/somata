# Shared saved goals: rollout note

Web and mobile now use the authenticated Firebase user's `users/{uid}` document
for saved profile fields and nutrition goals. A valid accepted
`activeFitAdaptTargets` on that document wins over saved goals; a pending
proposal does not change targets. Only the existing trusted FitAdapt callable
may change the accepted projection or plan state.

Older web releases wrote `profiles/{uid}`. Those documents may contain user
goals, measurements, activity settings, identity data, and generated defaults.
Their provenance cannot be established from the document alone. This change
does **not** copy them automatically, infer links between different UIDs, or
delete them. The local rules add owner-only `get` access to that legacy path;
all client writes and list queries remain denied. The web Profile shows a
reviewable import only when the same signed-in UID has validated legacy fields
that differ from the shared profile. The user explicitly chooses whether to
import them. A transaction checks that both documents still match the preview
and copies only validated goal/profile fields. Repeating the import makes no
further change. It never writes FitAdapt-owned fields or `goalInputs` and
`goalResult`, for which the old web document has no verified equivalent.

No production data migration is run by this checkpoint. For a future release,
an operator must first review and deploy the owner-only legacy read rule, then
release the updated web client. Users who want older web values in their shared
profile can sign in with the **same Firebase account** and approve the import
on the web Profile page. Until they do, `users/{uid}` is the shared fallback;
the old document is preserved. Accounts with different UIDs require an
independent, verified account-linking decision outside this checkpoint. Do not
copy their profile data based on email or display name.

The local rules test uses only `demo-somata-fitadapt` Auth and Firestore
emulators. It checks same-UID access, owner-only legacy reads, rejected writes,
shared saved goals, and preservation of accepted targets. Unit tests check the
import field allowlist, missing values, units, and target precedence. No local
test establishes the content or ownership of existing production documents.
