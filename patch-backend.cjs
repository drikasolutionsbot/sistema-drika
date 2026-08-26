const fs = require('fs');

function removeLofyPay() {
  // 1. check-payment-status
  let f1 = 'supabase/functions/check-payment-status/index.ts';
  let c1 = fs.readFileSync(f1, 'utf8');
  c1 = c1.replace(/,\s*"lofypay"/g, '');
  c1 = c1.replace(/\|\s*"lofypay"/g, '');
  c1 = c1.replace(/provider === "lofypay"\s*\|\|\s*/g, '');
  c1 = c1.replace(/\|\|\s*provider === "lofypay"/g, '');
  fs.writeFileSync(f1, c1);

  // 2. payment-webhook
  let f2 = 'supabase/functions/payment-webhook/index.ts';
  let c2 = fs.readFileSync(f2, 'utf8');
  c2 = c2.replace(/\nasync function handleLofyPay[\s\S]*?\n}\n/m, '\n');
  c2 = c2.replace(/\n\s*case "lofypay":[\s\S]*?break;\n/m, '\n');
  fs.writeFileSync(f2, c2);

  // 3. test-payment
  let f3 = 'supabase/functions/test-payment/index.ts';
  let c3 = fs.readFileSync(f3, 'utf8');
  c3 = c3.replace(/\nasync function testLofyPay[\s\S]*?\n}\n/m, '\n');
  c3 = c3.replace(/\n\s*case "lofypay":[\s\S]*?break;\n/m, '\n');
  fs.writeFileSync(f3, c3);

  // 4. wallet-gateway-balance
  let f4 = 'supabase/functions/wallet-gateway-balance/index.ts';
  let c4 = fs.readFileSync(f4, 'utf8');
  c4 = c4.replace(/\nasync function lofyBalance[\s\S]*?\n}\n/m, '\n');
  c4 = c4.replace(/\s*else if \(body\.provider_key === "lofypay"\) result = await lofyBalance\(provider\);/g, '');
  c4 = c4.replace(/, LofyPay/g, '');
  c4 = c4.replace(/ \| lofypay/g, '');
  fs.writeFileSync(f4, c4);

  // 5. wallet-pix-deposit
  let f5 = 'supabase/functions/wallet-pix-deposit/index.ts';
  let c5 = fs.readFileSync(f5, 'utf8');
  c5 = c5.replace(/,\s*"lofypay"/g, '');
  c5 = c5.replace(/, LofyPay/g, '');
  fs.writeFileSync(f5, c5);

  // 6. wallet-pix-withdraw
  let f6 = 'supabase/functions/wallet-pix-withdraw/index.ts';
  let c6 = fs.readFileSync(f6, 'utf8');
  c6 = c6.replace(/\nasync function withdrawViaLofyPay[\s\S]*?\n}\n/m, '\n');
  // Need to be careful with the else if block
  c6 = c6.replace(/} else if \(provider_key === "lofypay"\) {[\s\S]*?} else if \(provider_key === "misticpay"\) {/m, '} else if (provider_key === "misticpay") {');
  c6 = c6.replace(/ \| lofypay/g, '');
  c6 = c6.replace(/\/\/\s*─── LofyPay.*?──\s+/g, '');
  c6 = c6.replace(/Efí\/LofyPay/g, 'Efí');
  fs.writeFileSync(f6, c6);

  console.log('Backend patched!');
}

removeLofyPay();
