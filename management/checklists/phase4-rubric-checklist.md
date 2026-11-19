# Phase 4 Rubric Checklist (Build / Prototype Phase)

Source: course rubric. Phase 4 scenario: the development team receives the Phase 3 blueprints and must build exactly what was designed, including at least one external API.

Deliverables: Working Prototype | Test Cases/Logs & API Integration Docs | Final Presentation/Defense
Tools named in the rubric: HTML/CSS/JS, PHP/Laravel or Python/Django, GitHub Actions, Postman

## 1. Fidelity to Design & API (30%)
Excellent: prototype matches the Phase 3 design perfectly and has at least 1 successful external API integration that adds business value.
- [ ] 3-4 core use cases chosen and written in docs/traceability-matrix.md
- [ ] Each core use case traced: use case > DFD process > ERD entities > screen > API endpoint > test case
- [ ] Prototype screens compared against the Figma designs; deviations listed with reasons
- [ ] At least 1 external API chosen, and its business value written in docs/api-integration/API_INTEGRATION.md
- [ ] API integration works in the deployed prototype
- [ ] API integration documentation complete (endpoints, auth, sample requests/responses, error handling)

## 2. Version Control & CI/CD (30%)
Excellent: GitHub used extensively; successfully deployed to a free cloud host or basic CI/CD implemented.
- [ ] Every member has commits (check Insights > Contributors)
- [ ] All work done on branches and merged through pull requests with a review
- [ ] Commit messages follow the format `<type>: <what changed>`
- [ ] GitHub Actions workflow exists in .github/workflows/ and shows green runs in the Actions tab
- [ ] Deployment to a free cloud host (Netlify is already used for the frontend; document the backend host)
- [ ] docs/technical/CI_CD.md describes the pipeline and how to redeploy
- [ ] A release/tag created for the prototype (Releases > Draft a new release)

## 3. Functionality & Testing (30%)
Excellent: core use cases work flawlessly; test logs clearly document bugs and fixes, including API response testing.
- [ ] Test plan and test cases in tests/
- [ ] Test log: each run with date, tester, result
- [ ] Bug log: every bug as a GitHub Issue (label `bug`) with steps, expected/actual result, screenshot, and the pull request that fixed it
- [ ] API response testing done in Postman; collection exported and saved in tests/ or docs/api-integration/
- [ ] Postman results (status codes, response samples) pasted in the API integration doc
- [ ] Core use cases retested after bug fixes and results recorded

## 4. Agile PM Usage (10%)
Excellent: Scrum board matches GitHub commits; progress highly visible.
- [ ] Project board has all tasks in the right columns
- [ ] Every pull request links an issue (`Closes #n`)
- [ ] Board automation enabled (closed issues and merged pull requests move to Done)
- [ ] Sprint notes for every sprint
- [ ] Weekly progress reports with a board screenshot

## Final Presentation / Defense
- [ ] Slides: problem and client, design recap, live demo of 3-4 core use cases, API integration demo, GitHub evidence (commits, pull requests, Actions runs, board), testing and bug log summary, lessons learned
- [ ] Demo account and sample data ready; backup screen recording
- [ ] Everyone knows which part they present
