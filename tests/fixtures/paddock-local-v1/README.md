# Local-library v1 contract fixtures

Copied from the user's SlotForge Paddock `integration-handoff/local-library-v1` handoff on 9 November 2026. These are synthetic identities and examples, not credentials from an active host.

`schema.json` describes the implemented host contract. Request hashes are verified with Timing's canonical serializer. The rejected-receipt fixture was generated from the create request with transfer ID `transfer-reject` and its car list replaced by `[{"id":"rejected-car","name":"Not wanted"}]`, as documented in Paddock's fixture generator.

Do not use the historical Timing pairing proposal as the API specification.
