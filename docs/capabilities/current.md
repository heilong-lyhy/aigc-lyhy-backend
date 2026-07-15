# Current Capability Decisions

Horizontal layers still decide technical responsibility. These decisions identify the product or
operational function a change belongs to and the explicit behavior gate a human reviewer can follow.

## `ai`

Owns product-level availability for the framework's AI functions. It is a real parent switch, not a
namespace-only grouping. Execution and Workflow retain their own queues and lifecycle.

## `ai.execution`

Owns queued generate and embed admission, provider selection and invocation, provider-call
observation, and the execution Worker lifecycle. It does not own workflow context or housekeeping.
Durable Async Task recording is a hard prerequisite.

## `ai.workflow`

Owns workflow context, admission policy, execution state, queue lifecycle, and housekeeping. It may
invoke AI Execution without absorbing provider execution or provider-call observations.

## `identity.account`

Owns account identity, profile, credential, access facts, and account-registration completion
semantics. Authentication/session issuance, verification records, and external-account binding remain
outside this boundary.

## `identity.authentication`

Owns authentication, token/session issuance, and current-user projection. Account persistence and
external-account binding remain with their owning capabilities.

## `identity.external-account`

Owns local external-account binding facts together with provider identity exchange used by those
flows. It does not own account registration policy or authentication/session issuance.

## `identity.verification`

Owns verification challenge creation, lookup, consumption, revocation, and their persisted facts.
The business outcome requesting verification remains with the requesting flow.

## `runtime.async-task`

Owns cross-runtime asynchronous task state, trace, attempts, and audit history. It does not own AI
workflow state or individual provider request/response facts.

## `runtime.email-delivery`

Owns email admission, queue transport, sendmail delivery, Worker lifecycle, and delivery health. It
does not own the business outcome that requested an email. Async Task recording is optional
observation: audit failure may reduce trace quality but must not rewrite an accepted or completed
delivery result. A disabled Worker does not claim queued jobs.

## `notification.email`

Owns the notification-level email capability: admission of notification-originated email requests
and delegation to a delivery provider. It is the parent capability for email-sending providers that
serve the notification use case surface. It does not own queue transport or sendmail delivery itself.

## `notification.email.sendmail`

Owns sendmail-specific delivery binding under `notification.email`. It is switchable: when disabled,
the sendmail provider does not claim jobs and notification emails remain undelivered until another
provider is enabled. It requires `notification.email` as its parent capability.

## `ai.provider-call-observation`

Owns AI provider call recording, observation metadata, and call-record persistence. It is always-on
and has no switchable gate. It belongs under `ai.execution` semantically but retains its own
capability ID for independent health observation of the call-record subsystem.

## `reference.profile`

Owns reference profile query, group-based lookup, and profile summary projection. It is always-on
and provides `ReferenceProfileQueryHandler` as a runtime contribution. Cross-capability consumers
access it through the narrow-typed `ReferenceProfileClient` contract, not through a generic bus.
