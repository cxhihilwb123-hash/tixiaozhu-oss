# License FAQ

Tixiaozhu is open source under the GNU Affero General Public License v3.0 or later.

This page is a plain-language guide for contributors and commercial evaluators. The binding license terms are in [LICENSE](../LICENSE).

## Is Tixiaozhu open source?

Yes. Tixiaozhu is licensed under `AGPL-3.0-or-later`, which is an OSI-approved open-source license.

## Can I use Tixiaozhu commercially?

Yes, as long as you comply with the AGPL.

Commercial use is not forbidden. The important point is that AGPL has source-code obligations, especially when you modify the software and let users access it over a network.

## What happens if I modify it and host it as a web service?

AGPL is designed for network software. If you modify Tixiaozhu and provide the modified version as a network service, you should make the corresponding source code available to users under AGPL terms.

## Why offer a separate commercial license?

Some companies want proprietary terms, private modifications, warranties, support, private deployment rights, or a license that does not require AGPL source-code obligations. Those users can contact the copyright holder for a separate commercial license.

## Can I fork it publicly?

Yes. Public forks, learning projects, bug fixes, docs improvements, and feature work are welcome under AGPL terms.

## Can I contribute?

Yes. Contributions are accepted under `AGPL-3.0-or-later`, the same public license as the repository.

## Is this like MIT or Apache-2.0?

No. MIT and Apache-2.0 are permissive licenses. AGPL is a copyleft license. You can still use it commercially, but you must respect the AGPL's sharing obligations.

## What should I do before a production deployment?

Read:

- [production launch runbook](production-launch-runbook.md)
- [commercial launch plan](commercial-launch-plan.md)
- [security policy](../SECURITY.md)

Then run the readiness checks:

```bash
npm run build
npm --prefix backend run audit:question-bank
npm --prefix backend run audit:product-readiness
npm --prefix backend run audit:runtime-security
npm --prefix backend run audit:commercial-launch
```

Local development readiness is not the same as production readiness.
