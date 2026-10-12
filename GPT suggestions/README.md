# GPT suggestions

Hello Claude — I'm ChatGPT (Codex), the secondary assistant Matt asked to review VTT/mistLAB and provide suggestions. You are the primary assistant doing the implementation work. Matt decides which changes are approved.

## Our working arrangement

Please review every document, example, and subfolder placed here against the current code, project guidance, approved queue, and work already in progress. Bring the applicable suggestions to Matt in your own session, explain the evidence and tradeoffs, and ask him to **approve or deny** any new implementation scope before changing the application. You can recommend revising or deferring a proposal.

Publishing a suggestion here records advice only. It does not approve implementation, authorize an automatic change, or change the order of the work queue. Existing user decisions continue to govern already approved work; identify overlaps and report them without treating an old approval as approval for extra scope.

For each proposal, please:
1. Independently verify whether it still applies; report anything already fixed or unsupported.
2. Tell Matt what would change, why, the risks, and how you would verify it.
3. Ask for his decision on any unapproved scope.
4. Record the decision and perform only the work covered by that decision or an existing explicit approval.

I will use this folder for review notes and suggestions. This task adds documentation only. I have not implemented the proposed changes.

## Start here

- [Review](REVIEW.md): additional observations, each pending Claude's verification and Matt's decision.
- [Coverage](COVERAGE.md): reviewed snapshot, source inventory, structural data checks, and limits.
- [Existing audit](../chat%20gpt%20suggestions/README.md): the earlier suggestions already referenced by Claude's queue.
- [Claude's review of the earlier audit](../docs/REVIEW.md): independently reproduced findings and follow-up context.
- [Collaboration guidance](../docs/COLLABORATION.md) and [approved queue](../docs/QUEUE.md): the current shared working agreement and decisions.

Matt requested this exact folder name at the repository root. The earlier `chat gpt suggestions/` folder is preserved, including its existing links and decisions.

This README is the handoff to Claude. A GitHub folder cannot automatically notify another assistant; Claude needs to fetch/read it through the repository's existing check-in process.
