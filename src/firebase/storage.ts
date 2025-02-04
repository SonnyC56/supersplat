import { initializeApp } from 'firebase/app';
import { getAuth, User, browserLocalPersistence, setPersistence } from 'firebase/auth';
import { getStorage, ref, uploadBytes, getDownloadURL, StorageReference } from 'firebase/storage';

export interface FirebaseConfig {
    apiKey: string;
    authDomain: string;
    projectId: string;
    storageBucket: string;
    messagingSenderId: string;
    appId: string;
    measurementId?: string;
}

export class FirebaseStorageManager {
    private storage;
    private auth;
    private userId: string;
    private authToken?: string;

    constructor(config: FirebaseConfig, userId: string, token?: string) {
        const app = initializeApp(config, 'supersplat-editor');
        this.storage = getStorage(app);
        this.auth = getAuth(app);
        this.userId = userId;

        // Store the token if provided
        this.authToken = token;

        // Initialize auth with persistence
        setPersistence(this.auth, browserLocalPersistence).catch((error) => {
            console.error('Error setting auth persistence:', error);
        });
    }

    private getSplatRef(filename: string): StorageReference {
        // Extract just the filename if it contains a path
        const justFilename = filename.split('/').pop();
        // Always construct the full path with the extracted filename
        return ref(this.storage, `users/${this.userId}/splats/${justFilename}`);
    }

    async uploadSplat(file: File | Blob, filename: string): Promise<string> {
        try {
            // Wait for authentication if no token is provided
            if (!this.authToken) {
                await new Promise<void>((resolve, reject) => {
                    const unsubscribe = this.auth.onAuthStateChanged((user) => {
                        unsubscribe();
                        if (user && user.uid === this.userId) {
                            resolve();
                        } else {
                            reject(new Error('Authentication failed. Please ensure you are logged in.'));
                        }
                    });
                });
            }

            // Upload file with authentication metadata
            const splatRef = this.getSplatRef(filename);
            const metadata = this.authToken ? {
                customMetadata: {
                    authToken: this.authToken
                }
            } : undefined;
            await uploadBytes(splatRef, file, metadata);
            return await getDownloadURL(splatRef);
        } catch (error) {
            console.error('Error uploading splat:', error);
            throw error;
        }
    }

    async downloadSplat(url: string): Promise<ArrayBuffer> {
        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return await response.arrayBuffer();
        } catch (error) {
            console.error('Error downloading splat:', error);
            throw error;
        }
    }

    // Public method to check authentication
    async waitForAuth(): Promise<void> {
        if (this.authToken) {
            // Token is available, no need to wait for auth state
            return;
        }

        // Fall back to checking auth state
        await new Promise<void>((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('Authentication timeout'));
            }, 5000);

            const unsubscribe = this.auth.onAuthStateChanged((user) => {
                clearTimeout(timeout);
                unsubscribe();
                if (user?.uid !== this.userId) {
                    reject(new Error('Authentication failed. Please ensure you are logged in.'));
                }
                resolve();
            });
        });
    }
}

// Parse URL parameters to get Firebase config and user ID
export function getFirebaseParams(): { config: FirebaseConfig; userId: string; token?: string } | null {
    try {
        const params = new URLSearchParams(window.location.search);
        const configStr = params.get('config');
        const userId = params.get('userId');
        const token = params.get('token');

        if (!configStr || !userId) {
            console.error('Missing required Firebase parameters');
            return null;
        }

        const config = JSON.parse(decodeURIComponent(configStr));
        return {
            config,
            userId,
            token: token ? decodeURIComponent(token) : undefined
        };
    } catch (error) {
        console.error('Error parsing Firebase parameters:', error);
        return null;
    }
}

// Initialize Firebase storage with URL parameters
export async function initializeFirebaseStorage(): Promise<FirebaseStorageManager | null> {
    const params = getFirebaseParams();
    if (!params) return null;

    try {
        const manager = new FirebaseStorageManager(params.config, params.userId, params.token);
        await manager.waitForAuth();
        return manager;
    } catch (error) {
        console.error('Error initializing Firebase storage:', error);
        return null;
    }
}
