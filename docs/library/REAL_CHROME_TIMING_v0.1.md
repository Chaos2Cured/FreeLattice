Speed claims in PRs come from this harness, not Node.
The harness measures inside the page (window present, process undefined). It misses a one-shot long task inside the evaluated task itself, which reports 0; an async 120 ms task reports 120.
page.route does not cover service-worker or worker requests, so those are not blocked.
The box runs Chrome 155.0.8059.84; 156 is unverified.
