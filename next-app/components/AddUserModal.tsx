import React, { useEffect, useReducer } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useProfiles } from '@/hooks/useProfiles';
import { User } from '@/types/api';
import { Eye, EyeOff, Shield, Network, UserIcon } from 'lucide-react';
import { Switch } from './ui/switch';
import useUsers, { AccountStatus } from '@/hooks/useUsers';

interface AddUserModalProps {
    isOpen: boolean;
    onClose: () => void;
    onUserAdded: () => void;
    editingUser: User | null;
}

type State = {
    username: string;
    password: {
        value: string;
    };
    selectedProfile: string;
    accountStatus: string;
    freenight: boolean;
    quotaResetDay: string;
    quotaCycleStartDate: string;
    showPassword: boolean;
    fullName: string;
    address: string;
    phoneNumber: string;
    email: string;
};

type Action =
    | { type: 'SET_FIELD'; field: keyof State; value: string | boolean | undefined }
    | { type: 'RESET_FORM' }
    | { type: 'SET_EDITING_USER'; user: User };

const initialState: State = {
    username: '',
    password: {
        value: ''
    },
    selectedProfile: '',
    accountStatus: 'active',
    freenight: false,
    quotaResetDay: '1',
    quotaCycleStartDate: '',
    showPassword: false,
    fullName: '',
    address: '',
    phoneNumber: '',
    email: '',
};

function reducer(state: State, action: Action): State {
    switch (action.type) {
        case 'SET_FIELD':
            console.log(action.field, action.value);
            if (action.field === 'password') {
                return { ...state, password: { value: action.value as string } };
            }
            return { ...state, [action.field]: action.value };
        case 'RESET_FORM':
            return initialState;
        case 'SET_EDITING_USER':
            return {
                ...state,
                username: action.user.username,
                password: { value: action.user.password.value },
                selectedProfile: action.user.profile.id.toString(),
                accountStatus: action.user.accountStatus,
                freenight: Boolean((action.user as any).freenight),
                quotaResetDay: action.user.quotaResetDay?.toString() || '1',
                quotaCycleStartDate: action.user.quotaCycleStartDate?.slice(0, 10) || '',
                fullName: action.user.userDetails?.fullName || '',
                address: action.user.userDetails?.address || '',
                phoneNumber: action.user.userDetails?.phoneNumber || '',
                email: action.user.userDetails?.email || '',
            };
        default:
            return state;
    }
}
const AddUserModal: React.FC<AddUserModalProps> = ({ isOpen, onClose, onUserAdded, editingUser }) => {
    const [state, dispatch] = useReducer(reducer, initialState);
    const { data, error, isLoading } = useProfiles();
    const { updateUserMutation, createUserMutation } = useUsers();

    useEffect(() => {
        if (editingUser) {
            dispatch({ type: 'SET_EDITING_USER', user: editingUser });
        } else {
            dispatch({ type: 'RESET_FORM' });
        }
    }, [editingUser]);

    // Add this new useEffect
    useEffect(() => {
        if (data?.data && data.data.length > 0) {
            if (editingUser) {
                const userProfileId = editingUser.profile?.id?.toString();
                const profileExists = data.data.some(profile => profile.id?.toString() === userProfileId);
                dispatch({
                    type: 'SET_FIELD',
                    field: 'selectedProfile',
                    value: profileExists ? userProfileId : data.data[0].id?.toString()
                });
            }
            //  else if (!state.selectedProfile) {
            //     dispatch({
            //         type: 'SET_FIELD',
            //         field: 'selectedProfile',
            //         value: data.data[0].id?.toString()
            //     });
            // }
        }
    }, [data, editingUser]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const profileId = state.selectedProfile ? parseInt(state.selectedProfile, 10) : -1;
        const userData = {
            username: state.username,
            password: state.password.value,
            profileId,
            accountStatus: state.accountStatus as AccountStatus,
            freenight: state.freenight,
            quotaResetDay: parseInt(state.quotaResetDay, 10),
            quotaCycleStartDate: state.quotaCycleStartDate.trim() ? state.quotaCycleStartDate.trim() : null,
            fullName: state.fullName,
            address: state.address,
            phoneNumber: state.phoneNumber,
            email: state.email,
        };
        console.log(userData);
        if (editingUser) {
            updateUserMutation.mutate(userData, {
                onSuccess: () => {
                    alert("User updated successfully!");
                    onUserAdded();
                    onClose();
                },
                onError: (error) => {
                    alert(`Error updating user: ${error.message}`);
                }
            });
        } else {
            createUserMutation.mutate(userData, {
                onSuccess: () => {
                    alert("User created successfully!");
                    onClose();
                },
                onError: (error) => {
                    alert(`Error creating user: ${error.message}`);
                }
            });
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[700px] max-w-[95vw] h-[90vh] flex flex-col p-0 overflow-hidden">
                <DialogHeader className="px-6 py-4 border-b bg-background/90 backdrop-blur shrink-0">
                    <DialogTitle>{editingUser ? 'Edit User' : 'Add New User'}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="flex flex-col flex-grow overflow-hidden">
                    <div className="flex-grow overflow-y-auto p-6 space-y-6">
                        {/* 2-column grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            
                            {/* Column 1: Auth & Personal */}
                            <div className="space-y-6">
                                {/* Authentication & Security */}
                                <div className="rounded-xl border border-border/70 bg-card/50 shadow-sm overflow-hidden">
                                    <div className="px-4 py-3 border-b border-border/50 bg-muted/20 flex items-center gap-2">
                                        <Shield className="w-4 h-4 text-primary" />
                                        <h3 className="text-sm font-semibold">Authentication</h3>
                                    </div>
                                    <div className="p-4 space-y-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="username">Username</Label>
                                            <Input
                                                id="username"
                                                value={state.username}
                                                onChange={(e) => dispatch({ type: 'SET_FIELD', field: 'username', value: e.target.value })}
                                                disabled={!!editingUser}
                                                required
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="password">Password</Label>
                                            <div className="flex">
                                                <Input
                                                    id="password"
                                                    type={state.showPassword ? "text" : "password"}
                                                    value={state.password.value}
                                                    onChange={(e) => dispatch({ type: 'SET_FIELD', field: 'password', value: e.target.value })}
                                                    className="flex-grow rounded-r-none"
                                                />
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    onClick={() => dispatch({ type: 'SET_FIELD', field: 'showPassword', value: !state.showPassword })}
                                                    className="rounded-l-none border-l-0 px-3"
                                                >
                                                    {state.showPassword ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
                                                </Button>
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="accountStatus">Account Status</Label>
                                            <Select
                                                value={state.accountStatus}
                                                onValueChange={(value) => dispatch({ type: 'SET_FIELD', field: 'accountStatus', value })}
                                            >
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Select account status" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="active">Active</SelectItem>
                                                    <SelectItem value="suspended">Suspended</SelectItem>
                                                    <SelectItem value="blocked">Blocked</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                </div>

                                {/* Personal Information */}
                                <div className="rounded-xl border border-border/70 bg-card/50 shadow-sm overflow-hidden">
                                    <div className="px-4 py-3 border-b border-border/50 bg-muted/20 flex items-center gap-2">
                                        <UserIcon className="w-4 h-4 text-primary" />
                                        <h3 className="text-sm font-semibold">Personal Information</h3>
                                    </div>
                                    <div className="p-4 space-y-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="fullName">Full Name</Label>
                                            <Input
                                                id="fullName"
                                                value={state.fullName}
                                                onChange={(e) => dispatch({ type: 'SET_FIELD', field: 'fullName', value: e.target.value })}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="email">Email</Label>
                                            <Input
                                                id="email"
                                                type="email"
                                                value={state.email}
                                                onChange={(e) => dispatch({ type: 'SET_FIELD', field: 'email', value: e.target.value })}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="phoneNumber">Phone Number</Label>
                                            <Input
                                                id="phoneNumber"
                                                value={state.phoneNumber}
                                                onChange={(e) => dispatch({ type: 'SET_FIELD', field: 'phoneNumber', value: e.target.value })}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="address">Address</Label>
                                            <Input
                                                id="address"
                                                value={state.address}
                                                onChange={(e) => dispatch({ type: 'SET_FIELD', field: 'address', value: e.target.value })}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Column 2: Network & Quota */}
                            <div className="space-y-6">
                                <div className="rounded-xl border border-border/70 bg-card/50 shadow-sm overflow-hidden">
                                    <div className="px-4 py-3 border-b border-border/50 bg-muted/20 flex items-center gap-2">
                                        <Network className="w-4 h-4 text-primary" />
                                        <h3 className="text-sm font-semibold">Network & Quota</h3>
                                    </div>
                                    <div className="p-4 space-y-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="profile">Profile</Label>
                                            <Select
                                                value={state.selectedProfile || undefined}
                                                onValueChange={(value) => dispatch({ type: 'SET_FIELD', field: 'selectedProfile', value })}
                                            >
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Select a profile" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {isLoading ? (
                                                        <SelectItem value="-1">Loading profiles...</SelectItem>
                                                    ) : error ? (
                                                        <SelectItem value="-1">Error loading profiles</SelectItem>
                                                    ) : (
                                                        data?.data?.map((profile) => (
                                                            <SelectItem key={profile.id} value={profile.id?.toString() || ''}>
                                                                {profile.profileName}
                                                            </SelectItem>
                                                        ))
                                                    )}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="flex items-center justify-between p-3 rounded-lg border border-border/50 bg-muted/10">
                                            <div className="space-y-0.5">
                                                <Label htmlFor="freenight" className="text-sm">Freenight Access</Label>
                                                <p className="text-xs text-muted-foreground">Allow unlimited data during off-peak hours</p>
                                            </div>
                                            <Switch
                                                id="freenight"
                                                checked={state.freenight}
                                                onCheckedChange={(checked) => dispatch({ type: 'SET_FIELD', field: 'freenight', value: checked })}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="quotaResetDay">Quota Reset Day</Label>
                                            <Input
                                                id="quotaResetDay"
                                                type="number"
                                                min="1"
                                                max="31"
                                                value={state.quotaResetDay}
                                                onChange={(e) => dispatch({ type: 'SET_FIELD', field: 'quotaResetDay', value: e.target.value })}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="quotaCycleStartDate">Manual cycle start</Label>
                                            <Input
                                                id="quotaCycleStartDate"
                                                type="date"
                                                value={state.quotaCycleStartDate}
                                                onChange={(e) => dispatch({ type: 'SET_FIELD', field: 'quotaCycleStartDate', value: e.target.value })}
                                            />
                                            <p className="text-[11px] text-muted-foreground leading-snug">
                                                Optional. When set, monthly usage counts from this date; next reset is one month later. Leave empty to use reset day only.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                        </div>
                    </div>
                    <DialogFooter className="px-6 py-4 border-t bg-background shrink-0 flex items-center justify-end">
                        <Button variant="outline" type="button" onClick={onClose} className="mr-2">Cancel</Button>
                        <Button type="submit">{editingUser ? 'Update User' : 'Add User'}</Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
};

export default AddUserModal;

