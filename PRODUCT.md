# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Open decision. The product will be a responsive web application optimized for daily mobile use; implementation framework and deployment target have not yet been selected.

## Users

Families who share recurring household work. Multiple family members use the same household workspace, primarily on their phones. Each chore has a default owner, while the household can see shared maintenance status.

## Product Purpose

Help a family remember, coordinate, and complete recurring household maintenance before it becomes overdue. The product shows what needs attention now, what is coming due, the household's current weekly progress, and the estimated time remaining.

Success means family members can quickly understand the home's maintenance state, act on the most relevant chore, and record completion without maintaining a manual calendar or repeatedly reminding one another.

## Positioning

The product is a household maintenance rhythm system rather than a generic to-do list. Recurring chores are driven primarily by elapsed time since the last completion. Completion resets the next maintenance interval and updates the shared household status.

## Operating Context

- Daily interaction is mobile-first.
- Family members share one household workspace.
- Each chore has a default responsible person.
- Any household member may complete another member's chore without reassignment; the system records the person who actually completed it.
- Chores may be interval-based, such as washing towels every five days, or naturally associated with a period such as weekend cleaning.
- Initial example chores include weekly light cleaning, washing towels every five days, changing bed linen every two weeks, vacuuming the bed every three days, watering plants every two weeks, cleaning the balcony every three weeks, cleaning the bathroom weekly, deep-cleaning the kitchen every two weeks, and emptying the bathroom bin weekly.

## Capabilities and Constraints

First release:

- Household members and a shared household workspace.
- Recurring chores with a default owner, recurrence interval, estimated duration, and last-completed time.
- Due-state calculation based on time since last completion, including upcoming, due, and overdue states.
- A mobile-first view of recommended work, upcoming chores, weekly completion progress, and estimated remaining effort.
- Simple whole-chore completion; completing a chore resets its recurrence cycle.
- Default responsibility with frictionless substitute completion by any household member.
- Shared completion history sufficient to show who completed a chore and when.
- Reminders driven primarily by due state rather than only by fixed calendar events.

Deferred beyond the first release:

- Breaking a large chore into steps and tracking partial completion.
- Automatically learning duration from historical completion times. The first release uses an estimated duration entered for each chore.
- Automatically generated weekly email reports and email delivery. The product should preserve the data needed to add this later.

Open decisions:

- Reminder delivery channels and household notification rules.
- Implementation framework, deployment target, authentication method, and email provider.

## Brand Commitments

- Product name: 屋里.
- The interface should feel modern, warm, and quietly premium, with a contemporary Eastern residential character.
- Visual inspiration may be taken from Atour's restrained spacing, deep-green brand discipline, low-saturation natural imagery, and calm Chinese typography, without copying its hotel layouts, membership patterns, content, or navigation.
- The approved direction uses cool pearl-gray off-white surfaces, forest green as the single interface accent, natural home photography, crisp contemporary Chinese sans-serif type, fine-line icons, and restrained rounded geometry.
- Warmth comes from light, domestic materials, family presence, and gentle feedback rather than vintage paper, stamps, childish mascots, or gamification.

## Evidence on Hand

The user supplied a reference image showing maintenance status and urgency. It is an anti-reference for visual design: future work may learn only from the general need for legible status visualization and must not copy its structure or appearance. The user also supplied three Atour app screenshots as visual-quality references. The approved mobile home-screen composition is stored at `.impeccable/mocks/wuli-modern-warm.png`. No brand assets, usage analytics, testimonials, or existing implementation are available.

## Product Principles

- Show the household what deserves attention now instead of presenting an undifferentiated list.
- Base maintenance state on real completion history so the schedule stays current without manual calendar repair.
- Make shared responsibility visible while keeping completion lightweight.
- Communicate urgency without guilt or alarm fatigue.
- Keep the first release focused on whole chores; richer planning should not slow down everyday completion.
