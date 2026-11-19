# External API Integration Documentation

The rubric requires at least 1 external API that adds business value, and API integration docs as a deliverable.
Ask the developers which API they are using, then complete every section below. Do not write details you have not verified in the actual code and Postman results.

## 1. Summary
| Item | Value |
|------|-------|
| API name and provider | |
| Website / official documentation link | |
| Used in which module / use case | |
| Business value for Eli's Yummy Kitchen (one or two sentences) | |
| Free tier / limits | |
| Date integrated and by whom | |

## 2. Why this API
What problem it solves for the client, and what was done before without it.

## 3. Authentication
How access works (API key, token). Where the key is stored in the project (environment variable, never committed to GitHub), and who holds it.

## 4. Endpoints used
| Name | Method | URL | Purpose | Called from (screen / file) |
|------|--------|-----|---------|------------------------------|
| | | | | |

## 5. Request and response samples
For each endpoint: a sample request (headers and body) and a sample response, copied from Postman.

## 6. Error handling
| Situation | What the API returns | What the system does |
|-----------|----------------------|----------------------|
| Invalid key | | |
| Rate limit reached | | |
| Network failure | | |

## 7. Postman testing
- Collection file: (path in the repo)
- Tests run: date, tester, request, expected result, actual result, pass/fail
- Screenshot of results

## 8. Data flow
Sketch where the API sits in the DFD (which process calls it, which data store is updated). Add this diagram to docs/diagrams/.

## 9. Known limitations
