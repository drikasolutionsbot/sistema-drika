const fs = require('fs');

function patchFrontend() {
  // 1. src/components/wallet/WalletTab.tsx
  let f1 = 'src/components/wallet/WalletTab.tsx';
  let c1 = fs.readFileSync(f1, 'utf8');
  c1 = c1.replace(/\s*lofypay: "LofyPay",\n/, '\n');
  c1 = c1.replace(/new Set\(\["efi", "lofypay", "misticpay"\]\)/g, 'new Set(["efi", "misticpay"])');
  fs.writeFileSync(f1, c1);

  // 2. src/components/wallet/WalletBadge.tsx
  let f2 = 'src/components/wallet/WalletBadge.tsx';
  let c2 = fs.readFileSync(f2, 'utf8');
  c2 = c2.replace(/\["efi", "lofypay", "misticpay"\]/g, '["efi", "misticpay"]');
  fs.writeFileSync(f2, c2);

  // 3. src/components/payments/GatewayTutorialDialog.tsx
  let f3 = 'src/components/payments/GatewayTutorialDialog.tsx';
  let c3 = fs.readFileSync(f3, 'utf8');
  c3 = c3.replace(/\s*lofypay: \{[\s\S]*?\},\n\s*misticpay:/, '\n    misticpay:');
  fs.writeFileSync(f3, c3);

  console.log('Frontend basic patched!');
}

patchFrontend();
