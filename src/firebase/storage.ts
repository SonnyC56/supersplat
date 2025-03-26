import { initializeApp } from 'firebase/app';
import { getAuth, browserLocalPersistence, setPersistence, signInWithCustomToken } from 'firebase/auth';
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
    private authToken: string;
    private originalPath: string;

    constructor(config: FirebaseConfig, userId: string, authToken?: string, originalPath?: string) {
        const app = initializeApp(config, 'supersplat-editor');
        this.storage = getStorage(app);
        this.auth = getAuth(app);
        this.userId = userId;
        this.authToken = authToken;
        // Decode the originalPath if it's URL-encoded
        this.originalPath = originalPath ? decodeURIComponent(originalPath) : undefined;

        // Initialize auth with persistence
        setPersistence(this.auth, browserLocalPersistence).catch((error) => {
            console.error('Error setting auth persistence:', error);
        });

        // If we have an auth token, try to authenticate immediately
        if (this.authToken) {
            this.authenticateWithToken().catch(error => {
                console.error('Error authenticating with token:', error);
            });
        }
    }

    // Authenticate with the provided token
    private async authenticateWithToken(): Promise<void> {
        if (!this.authToken) {
            console.warn('No authentication token provided');
            return;
        }

        try {
            // Use the ID token directly with Firebase Auth
            await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithIdp?key=${this.auth.app.options.apiKey}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    postBody: `id_token=${this.authToken}&providerId=firebase`,
                    requestUri: window.location.href,
                    returnIdpCredential: true,
                    returnSecureToken: true
                })
            });
            
            console.log('Successfully authenticated with Firebase using ID token');
        } catch (error) {
            console.error('Error authenticating with Firebase:', error);
            throw error;
        }
    }

    private getSplatRef(filename: string): StorageReference {
        // If we have an original path from the URL parameters, use it for overwriting
        if (this.originalPath) {
            console.log(`Using original path for upload: ${this.originalPath}`);
            // The path is already decoded in the constructor
            return ref(this.storage, this.originalPath);
        }
        
        // Otherwise, use the default path construction
        // Extract just the filename if it contains a path
        const justFilename = filename.split('/').pop();
        // Always construct the full path with the extracted filename
        return ref(this.storage, `users/${this.userId}/splats/${justFilename}`);
    }

    async uploadSplat(file: File | Blob, filename: string): Promise<string> {
        try {
            // Wait for authentication
            await this.waitForAuth();

            // Use direct upload with token method directly since it's more reliable
            if (this.authToken) {
                return await this.directUploadWithToken(file, filename);
            } else {
                // Fallback to standard upload if no token is available
                const splatRef = this.getSplatRef(filename);
                await uploadBytes(splatRef, file);
                return await getDownloadURL(splatRef);
            }
        } catch (error) {
            console.error('Error uploading splat:', error);
            throw error;
        }
    }
    
    // Direct upload using the auth token with Firebase Storage REST API
    private async directUploadWithToken(file: File | Blob, filename: string): Promise<string> {
        if (!this.authToken) {
            throw new Error('No authentication token available for direct upload');
        }
        
        try {
            // Determine the upload path - originalPath is already decoded in the constructor
            let uploadPath = this.originalPath;
            if (!uploadPath) {
                const justFilename = filename.split('/').pop();
                uploadPath = `users/${this.userId}/splats/${justFilename}`;
            }
            
            console.log(`Attempting direct upload with token to path: ${uploadPath}`);
            
            // Create a FormData object with the file
            const formData = new FormData();
            formData.append('file', file);
            
            // Upload directly using the REST API with the ID token
            // Make sure we're encoding the path correctly for the URL
            const uploadUrl = `https://firebasestorage.googleapis.com/v0/b/${this.storage.app.options.storageBucket}/o/${encodeURIComponent(uploadPath)}`;
            
            const response = await fetch(uploadUrl, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.authToken}`
                },
                body: formData
            });
            
            if (!response.ok) {
                throw new Error(`Direct upload failed with status: ${response.status}`);
            }
            
            const data = await response.json();
            
            // Construct the download URL
            // Make sure we're encoding the path correctly for the URL
            const downloadURL = `https://firebasestorage.googleapis.com/v0/b/${this.storage.app.options.storageBucket}/o/${encodeURIComponent(uploadPath)}?alt=media`;
            
            console.log('Direct upload with token successful');
            return downloadURL;
        } catch (error) {
            console.error('Error during direct upload with token:', error);
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
        // If we have an auth token, try to authenticate with it first
        if (this.authToken && !this.auth.currentUser) {
            try {
                await this.authenticateWithToken();
                console.log('Successfully authenticated with token before upload');
                return;
            } catch (error) {
                console.error('Error authenticating with token before upload:', error);
                // Continue to check auth state even if token auth fails
            }
        }
        
        // checking auth state
        await new Promise<void>((resolve, reject) => {
            const timeout = setTimeout(() => {
                // If we have an auth token but authentication is timing out,
                // we'll try a direct upload approach
                if (this.authToken) {
                    console.log('Authentication timeout, but we have a token. Proceeding with upload.');
                    resolve();
                } else {
                    reject(new Error('Authentication timeout'));
                }
            }, 5000);

            const unsubscribe = this.auth.onAuthStateChanged((user) => {
                clearTimeout(timeout);
                unsubscribe();
                if (!user) {
                    if (this.authToken) {
                        // If we have a token but no user, we'll still try to proceed
                        console.log('No user authenticated, but we have a token. Proceeding with upload.');
                        resolve();
                    } else {
                        reject(new Error('Authentication failed. Please ensure you are logged in.'));
                    }
                } else {
                    console.log('User is authenticated:', user.uid);
                    resolve();
                }
            });
        });
    }
}
export function getFirebaseParams(): { config: FirebaseConfig; userId: string; authToken?: string; originalPath?: string } | null {
    try {
        const params = new URLSearchParams(window.location.search);
        const configStr = params.get('config');
        const userId = params.get('userId');
        const authToken = params.get('authToken');
        const originalPath = params.get('originalPath');

        if (!configStr || !userId) {
            console.error('Missing required Firebase parameters');
            return null;
        }

        const config = JSON.parse(decodeURIComponent(configStr));
        return {
            config,
            userId,
            authToken: authToken ? authToken : undefined,
            originalPath: originalPath ? originalPath : undefined
        };
    } catch (error) {
        console.error('Error parsing Firebase parameters:', error);
        return null;
    }
}
// Initialize Firebase storage with URL parameters
export function initializeFirebaseStorage(): FirebaseStorageManager {
    const params = getFirebaseParams();
    if (!params) {
        console.error('Missing required Firebase parameters');
        return null;
    }
    
    const { config, userId, authToken, originalPath } = params;

    if (!config || !userId) {
        console.error('Missing required Firebase parameters');
        return null;
    }

    try {
        const manager = new FirebaseStorageManager(config, userId, authToken, originalPath);
        return manager;
    } catch (error) {
        console.error('Error initializing Firebase storage:', error);
        return null;
    }
}
