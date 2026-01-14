// Shared OTP storage across API routes
// Uses global to persist across hot reloads in development

interface OTPData {
  otp: string;
  expires: number;
  attempts: number;
}

// Singleton pattern to ensure same instance across imports
class OTPStore {
  private static instance: OTPStore;
  public store: Map<string, OTPData>;

  private constructor() {
    // Use global store to persist across hot reloads
    if (typeof global !== 'undefined' && (global as any).__otpStore) {
      this.store = (global as any).__otpStore;
      console.log('♻️ Reusing existing OTP store from global');
    } else {
      this.store = new Map<string, OTPData>();
      if (typeof global !== 'undefined') {
        (global as any).__otpStore = this.store;
      }
      console.log('🆕 Created new OTP store');
    }
  }

  public static getInstance(): OTPStore {
    if (!OTPStore.instance) {
      OTPStore.instance = new OTPStore();
    }
    return OTPStore.instance;
  }

  public set(email: string, data: OTPData): void {
    this.store.set(email, data);
    console.log(`📝 OTP stored for ${email}: ${data.otp} (expires in ${Math.round((data.expires - Date.now()) / 1000)}s)`);
    console.log(`📊 Total OTPs in store: ${this.store.size}`);
  }

  public get(email: string): OTPData | undefined {
    const data = this.store.get(email);
    if (data) {
      console.log(`🔍 OTP retrieved for ${email}: ${data.otp} (${data.attempts} attempts)`);
    } else {
      console.log(`❌ No OTP found for ${email}`);
      console.log(`📊 Available emails in store: ${Array.from(this.store.keys()).join(', ') || 'none'}`);
    }
    return data;
  }

  public delete(email: string): void {
    this.store.delete(email);
    console.log(`🗑️ OTP deleted for ${email}`);
    console.log(`📊 Remaining OTPs: ${this.store.size}`);
  }

  public has(email: string): boolean {
    return this.store.has(email);
  }

  public cleanup(): void {
    const now = Date.now();
    let cleaned = 0;
    for (const [email, data] of this.store.entries()) {
      if (data.expires < now) {
        this.store.delete(email);
        cleaned++;
      }
    }
    if (cleaned > 0) {
      console.log(`🧹 Cleaned ${cleaned} expired OTPs`);
    }
  }
}

export const otpStore = OTPStore.getInstance();
export type { OTPData };
