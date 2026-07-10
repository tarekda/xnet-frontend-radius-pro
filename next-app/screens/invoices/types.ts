export interface Invoice {
    id: number;
    billingMonth: string;
    amount: number;
    status: string;
    userProfile: {
        username: string;
        profile: {
            profileName: string;
        };
    };
    userDetails?: {
        fullName: string;
        email?: string;
        phoneNumber?: string;
    };
}
