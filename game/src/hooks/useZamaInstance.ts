import { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { createInstance, initSDK, SepoliaConfig } from '@zama-fhe/relayer-sdk/web';

const TFHE_WASM_PATH = '/tfhe_bg.wasm';
const KMS_WASM_PATH = '/kms_lib_bg.wasm';

export function useZamaInstance() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [instance, setInstance] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { isConnected } = useAccount();

  useEffect(() => {
    let mounted = true;

    const initZama = async () => {
      // Don't initialize until wallet is connected
      if (!isConnected || !window.ethereum) {
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setError(null);
        
        // Initialize SDK
        await initSDK({
          tfheParams: TFHE_WASM_PATH,
          kmsParams: KMS_WASM_PATH,
        });
        
        // Get Infura API key from environment variables
        const INFURA_API_KEY = import.meta.env.VITE_INFURA_API_KEY;
        console.log("=== Environment Variables Check ===");
        console.log("VITE_INFURA_API_KEY:", INFURA_API_KEY);
        console.log("VITE_INFURA_API_KEY type:", typeof INFURA_API_KEY);
        console.log("VITE_INFURA_API_KEY length:", INFURA_API_KEY?.length || 0);
        console.log("VITE_INFURA_API_KEY is defined:", INFURA_API_KEY !== undefined);
        console.log("VITE_INFURA_API_KEY is truthy:", !!INFURA_API_KEY);
        console.log("All import.meta.env keys:", Object.keys(import.meta.env));
        console.log("===================================");
        let zamaInstance;
        
        // Log SepoliaConfig to see what it contains
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const sepConfig = SepoliaConfig as any;
        console.log('=== SepoliaConfig Analysis ===');
        console.log('SepoliaConfig.network:', sepConfig.network);
        console.log('SepoliaConfig.network type:', typeof sepConfig.network);
        console.log('============================');
        
        // SDK's getProvider function:
        // - If config.network is string → creates JsonRpcProvider from URL
        // - If config.network is object (EIP1193) → creates BrowserProvider from it
        // Since Infura API key returns 401, let's use wallet provider directly
        // Wallet provider (window.ethereum) avoids both CORS and 401 errors
        
        console.log('Using wallet provider (window.ethereum) to avoid CORS and 401 errors...');
        
        // Use wallet provider directly - it's EIP1193 compatible and avoids CORS
        const walletProvider = window.ethereum;
        
        // Create custom config with wallet provider
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const customConfig: any = {
          ...SepoliaConfig,
          // Override 'network' with wallet provider (EIP1193 compatible)
          network: walletProvider,
        };
        
        console.log('Custom config:', {
          network: customConfig.network,
          networkType: typeof customConfig.network,
          isEIP1193: typeof walletProvider?.request === 'function',
        });
        
        try {
          zamaInstance = await createInstance(customConfig);
          console.log('Zama instance created successfully with wallet provider');
        } catch (walletError: unknown) {
          console.error('Failed to create instance with wallet provider:', walletError);
          
          // If wallet provider fails, try with Infura URL as string (if API key is valid)
          if (INFURA_API_KEY) {
            console.log('Trying with Infura URL as string...');
            const infuraUrl = `https://sepolia.infura.io/v3/${INFURA_API_KEY}`;
            const infuraConfig = {
              ...SepoliaConfig,
              network: infuraUrl, // Pass as string URL, SDK will create JsonRpcProvider
            };
            
            try {
              zamaInstance = await createInstance(infuraConfig);
              console.log('Zama instance created with Infura URL');
            } catch (infuraError) {
              console.warn('Failed with Infura URL, using default config:', infuraError);
              zamaInstance = await createInstance(SepoliaConfig);
            }
          } else {
            console.warn('No Infura API key, using default config (may have CORS issues)');
            zamaInstance = await createInstance(SepoliaConfig);
          }
        }

        if (mounted) {
          setInstance(zamaInstance);
        }
      } catch (err) {
        console.error('Failed to initialize Zama instance:', err);
        if (mounted) {
          setError('Failed to initialize encryption service');
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    initZama();

    return () => {
      mounted = false;
    };
  }, [isConnected]);

  return { instance, isLoading, error };
}