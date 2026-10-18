# Five-tab design preview inventory

Open **Preview dashboard design** from the current Home tab. The preview lives at `/design-preview` and never changes the default five-tab route. **Current app** in its top bar returns to `/(tabs)`. All five preview tabs have their own screen composition; the current screens are kept for comparison.

| Current tab capability | Preview entry and existing action path |
| --- | --- |
| Home: accepted/saved targets, daily nutrition, steps, weight, plan review | Plan strip and compact metric grid; Profile opens the existing FitAdapt callables; targets use `dashboardPreviewPlan` and `nutritionTargets` |
| Home: food logging, scanning, steps, workout, activity, hydration | Quick-action cluster; existing add-meal, workout session, ActivityLogSheet, quick-workout, and quick-hydration flows; step writes use the existing profile service |
| Home: calendar, badges, connection/sync status, progress, next-step cues | Explore and evidence-based next-step card; existing calendar, badges, integration, and Insights destinations |
| Workouts: new, configured, resumed, quick and template sessions; template keep/archive/delete | Session hero, configuration sheet, built-in preset grid, saved template desk and library, and quick-workout route; built-in presets are shared with the current Workouts screen |
| Workouts: recorded training, recent work, activity add/edit/delete, coach, integrations | Seven-day recorded-sets chart, history/recap routes, account activity rows and existing ActivityLogSheet, coach actions, connections |
| Nutrition: date navigation, current goals, recorded calories/macros, meals | Date rail, energy arc, goal tracker, meal timeline; current targets use the shared helper and pending proposals are excluded |
| Nutrition: add/search/scan/manual/batch, quick add, builder, food edit/delete, suggestion, hydration | Existing modals and editor; existing AsyncStorage handoffs are consumed into the same food service; on-device water counter uses the existing `@water:<date>` key, while quick hydration retains its separate existing local log |
| Alerts: filter, open/deep link, unread, mark all read, dismiss, ping back, friends | Signal center, filter chips, per-alert actions and existing notification/friend services |
| Profile: current goals/accepted plan, pending review, explicit Accept/Decline, measured progress | Plan hero, separate proposal comparison/actions using the existing callable service, account-scoped step/weight records and measured trend |
| Profile: identity, goals, Insights/history, calendar, metrics, check-in, account, settings, theme, diet, photos, badges, friends, connections | Dedicated record, preference, and collection sections linked to existing working destinations |

No preview screen imports or wraps an existing five-tab screen. Shared modal editors and destination screens remain the established operations. The preview changes presentation and navigation only; accepted targets and proposal history are still written only through the trusted callable path.
