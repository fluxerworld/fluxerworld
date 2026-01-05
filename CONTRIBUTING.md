# Contributing to fluxerapp/fluxer

Thanks for contributing. This document explains how we work so your changes can land smoothly, and so nobody wastes time on work we cannot merge.

## Quick rules (please read)

### 1) All PRs must target `canary`

`canary` is our trunk branch. Open all pull requests against `canary`. PRs targeting other branches will be closed or you will be asked to retarget.

### 2) All PRs must include a short description

Every PR must include a short description covering:

- what changed
- why it changed
- anything reviewers should pay attention to

A few bullets is perfect.

### 3) Coordinate before starting larger work

If you are planning anything beyond a small, obvious fix (new feature, meaningful refactor, new dependency, new API surface, behavior changes), coordinate with the maintainers first.

This avoids the mutual displeasure of:

- you investing significant time, and
- us having to reject or postpone the change because it does not align with current goals, or because we are not ready to maintain what it introduces

Ways to coordinate:

- open an issue describing the problem and your proposed approach
- open a draft PR early to confirm direction
- discuss with a maintainer in any channel you already share

If you are unsure whether something counts as "larger work", ask first.

## Workflow

1. Fork the repo (or create a branch if you have access).
2. Create a feature branch from `canary`.
3. Make changes.
4. Open a PR into `canary` with a short description.
5. Address review feedback and CI results.
6. We squash-merge approved PRs into `canary`.

We strongly prefer small, focused PRs that are easy to review.

### Commit style and history

We squash-merge PRs, and the PR title becomes the single commit message on `canary`. For that reason:

- PR titles must follow Conventional Commits.
- Individual commits inside the PR do not need to follow Conventional Commits.

If you like to commit in small increments, feel free. If you prefer a tidier PR history, force-pushes are welcome (for example, to squash or reorder commits before review). Just avoid rewriting history in a way that makes it hard for reviewers to follow along.

## Conventional Commits (required for PR titles)

Because the PR title becomes the squash commit message, we require Conventional Commits for PR titles.

We prefer type/subject to be mostly lowercase.

Format:

- `type(scope optional): short description`

Examples:

- `fix: handle empty response from api`
- `feat(auth): add passkey login`
- `docs: clarify canary workflow`
- `refactor: simplify retry logic`
- `chore(ci): speed up checks`

Breaking changes:

- `feat!: remove legacy auth endpoints`
- `refactor(api)!: change pagination shape`

Common types:
`feat`, `fix`, `docs`, `refactor`, `perf`, `test`, `chore`, `ci`, `build`, `revert`

## Tests (guidance)

We care about confidence more than ceremony. Add tests when they provide real value.

### Backend changes

For backend changes, we suggest adding an integration or unit test.

- If a unit test would require heavy mocking to be meaningful, either:
  - restructure the code so it can be tested without excessive mocking, or
  - prefer an integration test if restructuring is not practical

- If you are unsure which route is best, discuss it with a maintainer before investing time.

### Frontend changes

We generally do not encourage new unit tests for frontend code unless:

- the area already has unit tests, or
- the change is complex or sensitive, and a unit test clearly reduces risk

In most cases, clear PR notes and practical verification are more valuable.

## Formatting and linting

Do not block on formatting or linting before opening a PR. CI enforces required checks and will tell you what needs fixing before merge.

Open the PR when it is ready for review, then iterate based on CI and feedback.

## CLA (required)

We require a Contributor License Agreement (CLA) for this repository.

Why:

- The project is available under AGPLv3.
- We also offer a commercial license for organizations that cannot (or do not want to) comply with AGPL obligations.
- To keep both options possible, we need permission to include contributions in both distributions.

What it means for you:

- You keep ownership of your contribution.
- You can keep using your contribution in your own work.
- You grant us the rights needed to distribute your contribution as part of the project, including under a commercial license.
- We may refactor or remove code over time and are not required to include every contribution. However, any distributed version that includes your contribution remains properly licensed under the project license(s) that applied when you contributed.

How to sign:

- On your first PR, a bot will comment with a CLA link.
- Click it, sign with your GitHub account, and you are done.

## PR checklist

Before requesting review:

- [ ] PR targets `canary`
- [ ] PR title follows Conventional Commits (mostly lowercase)
- [ ] PR includes a short description of what/why
- [ ] Tests added or updated where it makes sense (especially backend changes)
- [ ] CI is green (or you are actively addressing failures)
- [ ] CLA signed (the bot will guide you)

Optional but helpful:

- screenshots or a short recording for UI changes
- manual verification steps

## Code of Conduct

This project follows a Code of Conduct. By participating, you are expected to uphold it:

- See [`CODE_OF_CONDUCT.md`](./CODE_OF_CONDUCT.md)

## Security

Please do not report security issues via public GitHub issues.

Use our security policy and reporting instructions here:

- https://fluxer.app/security
