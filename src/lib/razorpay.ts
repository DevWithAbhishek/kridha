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