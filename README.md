# open-source-cities
Instructions for applying open source principles to city administration.

The first instructions are an app: city work as signed changes in many people's
[atproto](https://atproto.com) repos. A neighbor **reports** a pothole; others
say it's the **same** issue; anyone **proposes** a fix; someone **claims** the
work, marks it **done**, and neighbors **sign off**. Every step is a record in
its author's own repo, signed by its author, and nobody owns the database. The
history of changes is the record.

Background: "Open Source Cities" and "You Need Source Control Even If You Don't
Code" at [edelmanja.substack.com](https://edelmanja.substack.com).

## Status: phase 0
- `lexicons/`: the record types (`org.jason-edelman.oscity.*`) and the shared
  location lexicons they use.
- `src/records.js`: builders that produce valid records and enforce the rules
  the schema can't, such as area-only privacy, alt text on photos, and each
  step pointing at the right kind of record.
- `docs/plan.md`: the plan and phases. `docs/decisions.md`: what's been decided.

```
npm install
npm test
```

Norfolk, Virginia is the test fixture. Nothing here is specific to it.

License: GPL-3.0.
