import Razorpay from 'razorpay'

//Singleton — one instance across warm serverless invocations
let _instance: Razorpay | null = null;

export function getRazorPay(): Razorpay {
    if (!_instance) {
        _instance = new Razorpay({
            key_id: process.env.RAZORPAY_KEY_ID!,
            key_secret: process.env.RAZORPAY_KEY_SECRET!,
        });
    }
    return _instance;
}
/**
 * 
 * declare global {
  interface Window {
    Razorpay: new (options: RazorpayOptions) => RazorpayInstance;
  }
}

interface RazorpayOptions {
  key: string;
  order_id: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  image: string;
  handler: (response: { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string }) => void;
  modal: { ondismiss: () => void };
  prefill?: { contact?: string };
  theme?: { color?: string };
}

interface RazorpayInstance {
  open: () => void;
}

export function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (document.querySelector('script[src*="checkout.razorpay"]')) {
      resolve(true);
      return;
    }
    const s = document.createElement('script');
    s.src = 'https://checkout.razorpay.com/v1/checkout.js';
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });
}

export async function initRazorpay(options: RazorpayOptions): Promise<void> {
  const loaded = await loadRazorpayScript();
  if (!loaded) throw new Error('Razorpay SDK failed to load');
  new window.Razorpay({ ...options, theme: { color: '#2A9D8F' } }).open();
}
 * 
 */