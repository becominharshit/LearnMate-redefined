# Email draft: ask Higgsfield about 16–17-year-old students

**Why send it:** Higgsfield's API Terms (section 4.6, checked 3 Nov 2026) say every end user must be
18 or older. There is no published parental-consent exception. This email asks for written
confirmation. Keep any reply with your business records.

**Send from** the email address on your Higgsfield account, to the support address shown in your
Higgsfield console (or `support@higgsfield.ai` if none is listed). Attach nothing; just paste the
text below.

---

**Subject:** Age requirement for supervised use by 16–17-year-old students (API account)

Hello Higgsfield team,

I am building LearnMate, a JEE exam-preparation app used mostly by students aged 16–18 in India. I
use the Higgsfield API for optional study illustrations and short educational videos.

Your API Terms require end users to be at least 18. I want to respect that rule, so I am writing to
ask whether you allow a supervised exception for 16–17-year-old students when all of the following
are true:

- The account is created and paid for by an adult (me / the student's parent or guardian).
- A parent or guardian gives verifiable consent before the feature is used; the consent, its date
  and scope are recorded in the student's account.
- The student can only request study illustrations and short educational clips; prompts and outputs
  are moderated and no personal photos are uploaded.
- Every result is labelled "AI-generated" and the student is told that AI can make mistakes.
- Our workspace has the model-training opt-out switched on, and generated files are removed from
  Higgsfield shortly after download.

If you can confirm in writing that this use is acceptable, I will enable the feature only for
accounts with a recorded parental approval and keep the confirmation on file. Could you also tell me:

1. Whether your terms permit this supervised use at all, and if so under which conditions?
2. Whether the requirement is to verify age of the end user, the account holder, or both?
3. Whether you need a specific consent record or a signed addendum from us?

If this is not permitted, I will keep Higgsfield restricted to users aged 18 and over. A short reply
either way is enough — thank you for your time.

Kind regards,
[Your name]
[LearnMate]
[Your Higgsfield account email or organisation ID]
[Your website, if live]

---

## What to do with the reply

| Reply | Action |
|---|---|
| Written "yes" with conditions | Save it in `docs/legal/` (not committed if it contains personal details). Add the conditions to the Phase 5 server check. Enable Higgsfield only for accounts with recorded parental approval **and** 18+, as the reply requires. |
| "No" or no reply | Keep Higgsfield 18+ only. Students aged 16–17 still get Claude diagrams and animated explanations, which need no Higgsfield access. |

Do not enable Higgsfield for under-18 accounts on the basis of this email alone — only on the basis
of Higgsfield's written confirmation.
