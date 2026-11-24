# Set up weekly clone statistics

The **Update clone statistics** workflow runs every Tuesday at 06:17 UTC and can also be started manually. It reads the repository's clone traffic and commits the updated README and `.github/clone-history.json`. Scheduled workflows run on the default branch.

1. In GitHub, create a [fine-grained personal access token](https://github.com/settings/personal-access-tokens/new). Select the `XinzeLee` account and limit repository access to `nn-playground`.
2. Under **Repository permissions**, set **Administration** to **Read-only**. Choose an expiration date and generate the token. Keep the token private.
3. Open the [repository Actions secrets page](https://github.com/XinzeLee/nn-playground/settings/secrets/actions), choose **New repository secret**, and save the token as `TRAFFIC_STATS_TOKEN`. Do not put it in the repository, workflow file, or chat.
4. Publish the workflow and README to the default branch. In the repository's **Actions** tab, open **Update clone statistics** and choose **Run workflow** to populate the badges immediately. Later updates run weekly.

The standard workflow token writes the results; the separate secret is used only to read traffic. Repository settings and branch protection must allow the workflow to push to the default branch. Renew the secret before its token expires.

GitHub only supplies clone traffic for the latest 14 days. The first update can capture up to that much prior activity; older activity cannot be recovered from this API. The cumulative total is assembled from saved daily counts, with overlapping snapshots replaced rather than added twice. If collection is interrupted long enough to miss a window, the badge will note possible gaps. The unique-clone badge uses GitHub's unique count for its latest 14-day window; unique users cannot be deduplicated across longer periods from the API's aggregates.
