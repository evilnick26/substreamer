# Issue #083 — AudioMuse-AI functional watchdog

**Date:** 2026-11-17
**Project:** sancti.fi Client / supporting infrastructure
**Status at end of session:** Phase 1 implemented, deployed and successfully validated against a controlled production outage. Repository packaging and operational documentation in progress.

## Objective

Implement a lightweight functional watchdog for AudioMuse-AI (AMA), detecting failures in its recommendation service and notifying the administrator without automatically restarting containers or modifying the deployment.

Monitoring must establish that AMA can generate recommendations, not merely that its Docker container is running.

## Investigation and findings

- AMA was running version **3.7.1** on `obscurity`, with separate Flask and worker containers.
- The authenticated `POST /api/alchemy` endpoint provides a suitable functional health check.
- A known Navidrome song ID can be used to request one recommendation.
- The watchdog can access AMA through `http://127.0.0.1:8001/api/alchemy`, avoiding an external network dependency.
- The existing Radio Infinite Bridge already uses an AMA machine-to-machine authentication token.
- `msmtp` was available for lightweight SMTP delivery using a Gmail App Password.
- A systemd oneshot service and monotonic timer provide sufficient scheduling without introducing another persistent process.

## Decisions and rationale

1. **Monitoring only for Phase 1.** No automatic container restarts, Docker socket access or remediation logic.
2. **Functional checks rather than container checks.** Require a valid authenticated AMA recommendation response.
3. **Three consecutive confirmed failures before notification.** Avoid alerting on isolated transient errors.
4. **One notification per incident.** Send an UNHEALTHY email after the threshold and a RECOVERED email after verified recovery.
5. **Distinguish failed from indeterminate.** Authentication and configuration uncertainty must not automatically count as confirmed AMA failure.
6. **Persist incident state.** Preserve the failure counter, alert status and pending notification between executions.
7. **Keep credentials separate from source.** Store AMA token, SMTP configuration and live configuration in protected root-owned files.
8. **Support maintenance mode.** A sentinel file suppresses checks and notifications, including across reboots.
9. **Use systemd.** A oneshot service and approximately two-minute timer avoid unnecessary infrastructure complexity.
10. **Keep development and production separate.** `futwick` remains the development workstation; `obscurity` runs the deployed service.

## Implementation

The watchdog was implemented in Python with:

- Authenticated AMA recommendation probing.
- A ten-second HTTP timeout.
- Healthy, failed and indeterminate probe classifications.
- Three-failure alert threshold.
- Failure and recovery email delivery through `msmtp`.
- Atomic persistent-state updates.
- A nonblocking execution lock.
- Maintenance sentinel support.
- Read-only dry-run probing.
- Structured journal messages.

Production locations:

- `/usr/local/libexec/ama-watchdog.py`
- `/etc/sanctifi/ama-watchdog/config.json`
- `/etc/sanctifi/ama-watchdog/ama-token`
- `/etc/sanctifi/ama-watchdog/msmtprc`
- `/etc/sanctifi/ama-watchdog/maintenance` (optional)
- `/var/lib/ama-watchdog/state.json`
- `/etc/systemd/system/ama-watchdog.service`
- `/etc/systemd/system/ama-watchdog.timer`

The protected configuration directory is root-only. Credentials and runtime state are excluded from version control.

The watchdog implementation, nine automated tests, systemd definitions and example configuration were copied into a clean staging directory for the proposed `sanctifi-infrastructure` GitHub repository.

The existing Radio Infinite Bridge was also copied into that staging area, excluding its live `.env`, Python bytecode and temporary Issue #077 patch script.

## Validation

### Automated tests

All **nine Python unit tests passed**, including:

- Healthy and timeout probe handling.
- Three-failure threshold.
- Duplicate-alert prevention.
- Indeterminate-result handling.
- Recovery behaviour.
- Cancellation of an undelivered failure notification.
- Complete simulated incident lifecycle.

The staged repository copy independently passed all nine tests in **0.003 seconds**.

### Normal operation

- Direct functional probe returned `healthy`, with a valid recommendation.
- The systemd service completed successfully.
- The persistent state file was created with mode `600`.
- The systemd timer was enabled and scheduled approximately every two minutes.

### Controlled production outage

Only the AMA Flask container was deliberately stopped. The AMA worker remained running.

Observed watchdog events on 17 November 2026:

| Time (UTC) | Event |
|---|---|
| 18:38:08 | Healthy recommendation probe |
| 18:40:08 | First confirmed failure |
| 18:42:18 | Second confirmed failure |
| 18:44:19 | Third confirmed failure |
| 18:44:19 | UNHEALTHY notification delivered |
| 18:48:37 | Healthy recommendation probe after manual restoration |
| 18:48:38 | RECOVERED notification delivered |

Both email notifications were confirmed received.

No automatic restart was attempted.

### Final production state

After manually restoring the AMA Flask container:

- Flask and worker containers were both running AMA **3.7.1**.
- Persistent state was `{"failures": 0, "alerted": false, "pending": null}`.
- The watchdog timer remained enabled and had a future scheduled execution.

The controlled outage and recovery test therefore passed.

## Operational controls

Stop monitoring:

```bash
sudo systemctl stop ama-watchdog.timer ama-watchdog.service
```

Resume monitoring:

```bash
sudo systemctl start ama-watchdog.timer
```

These commands do not stop or restart AMA.

For maintenance mode that survives reboot:

```bash
sudo touch /etc/sanctifi/ama-watchdog/maintenance
```

Remove the sentinel to resume normal probing:

```bash
sudo rm /etc/sanctifi/ama-watchdog/maintenance
```

Stopping the enabled timer alone does not prevent it restarting after a reboot.

## Outstanding work and release boundary

- Complete the separate `sanctifi-infrastructure` repository packaging and security review.
- Confirm the GitHub issue number for infrastructure repository setup before recording that work under a separate issue.
- Commit the Bridge and watchdog source, systemd units, safe configuration templates and operational documentation.
- Keep all live credentials and runtime state out of Git.
- Perform additional operational validation when justified, including SMTP delivery failures and reboot/maintenance behaviour.
- Upgrade AMA from **3.7.1 to 3.7.2** as a separate, backed-up deployment task.

Automatic remediation is explicitly outside Phase 1 scope.

## References

- [GitHub Issue #083 — AMA functional watchdog](https://github.com/evilnick26/substreamer/issues/83)
- Issue #077 Project Diary, 2026-11-17.
- Watchdog systemd journal and live outage/recovery validation, 2026-11-17.

**Diary note:** This entry records the implementation and validation completed on 17 November. Repository publication and the AMA 3.7.2 upgrade were not yet completed at the point recorded here.
