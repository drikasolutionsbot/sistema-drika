require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

console.log('Listening for real-time events on orders...');

supabase
  .channel('test-channel')
  .on(
    'postgres_changes',
    { event: 'UPDATE', schema: 'public', table: 'orders' },
    (payload) => {
      console.log('RECEIVED UPDATE:', payload.new.id, 'status:', payload.new.status);
    }
  )
  .subscribe((status) => {
    console.log('Subscription status:', status);
    if (status === 'SUBSCRIBED') {
      console.log('Triggering update...');
      supabase.from('orders').update({ status: 'paid', updated_at: new Date().toISOString() }).eq('id', 'b12cb09b-faf2-4482-984f-29c645a76c3c')
        .then(() => {
          setTimeout(() => {
            supabase.from('orders').update({ status: 'delivered', updated_at: new Date().toISOString() }).eq('id', 'b12cb09b-faf2-4482-984f-29c645a76c3c');
          }, 1000);
        });
    }
  });

// Keep alive for 5 seconds
setTimeout(() => {
  console.log('Exiting...');
  process.exit(0);
}, 5000);
