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
  // 絕對下限：花費低於此金額一律不關。GCP 的預算「通知」可能延遲數小時，仍送出過時的
  // 低 budget 值（實測遇過 budget=1 而實際預算已改成 30），舊版盲信通知的 budget 會被零頭誤殺整個專案。
  // 有了 floor，只有花費真的超過 max(budget, floor) 才動作，天生免疫這個延遲 bug。
  const floor = Number(process.env.GUARD_MIN_COST || 50);
  const threshold = Math.max(budget, floor);
  console.log(
    `Budget notification: cost=${cost} budget=${budget} floor=${floor} threshold=${threshold} ${payload.currencyCode || ''}`,
  );

  // Only act on real spend over the effective threshold (max of budget and floor).
  if (!(cost > threshold)) {
    console.log(`Cost ${cost} within threshold ${threshold} — no action.`);
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
