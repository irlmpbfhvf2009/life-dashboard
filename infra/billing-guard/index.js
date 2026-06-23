const functions = require('@google-cloud/functions-framework');
const { CloudBillingClient } = require('@google-cloud/billing');

// Project whose billing should be disabled when the budget is exceeded.
const PROJECT_ID = process.env.GUARD_PROJECT_ID;
const billing = new CloudBillingClient();

/**
 * Triggered by a Cloud Billing budget notification (Pub/Sub).
 * When the ACTUAL cost exceeds the budget amount, it disables billing on the
 * project — which stops Cloud Run and prevents any further charges.
 *
 * Note: budget data updates only a few times per day, so this is a safety net,
 * not an instant cut-off. With Cloud Run min=0/max=1 there is no way to rack up
 * sudden large costs, so the lag is harmless.
 */
functions.cloudEvent('stopBilling', async (cloudEvent) => {
  const message = cloudEvent.data && cloudEvent.data.message;
  if (!message || !message.data) {
    console.log('No Pub/Sub data on event; ignoring.');
    return;
  }

  const payload = JSON.parse(Buffer.from(message.data, 'base64').toString());
  const cost = Number(payload.costAmount);
  const budget = Number(payload.budgetAmount);
  console.log(
    `Budget notification: cost=${cost} budget=${budget} ${payload.currencyCode || ''}`,
  );

  // Only act on real spend over budget (ignore forecasted-only notifications).
  if (!(cost > budget)) {
    console.log('Cost within budget — no action.');
    return;
  }

  if (!PROJECT_ID) {
    console.error('GUARD_PROJECT_ID env var is not set; cannot disable billing.');
    return;
  }

  const projectName = `projects/${PROJECT_ID}`;
  const [info] = await billing.getProjectBillingInfo({ name: projectName });
  if (!info.billingEnabled) {
    console.log('Billing already disabled — nothing to do.');
    return;
  }

  await billing.updateProjectBillingInfo({
    name: projectName,
    projectBillingInfo: { billingAccountName: '' }, // empty string disables billing
  });
  console.log(`!! BILLING DISABLED for ${PROJECT_ID} (cost ${cost} > budget ${budget}).`);
});
