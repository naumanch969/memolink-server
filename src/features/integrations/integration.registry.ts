import { IIntegrationProvider, IntegrationProviderIdentifier } from "./integration.interface";

class IntegrationRegistry {
    private providers: Map<IntegrationProviderIdentifier, IIntegrationProvider> = new Map();

    register(provider: IIntegrationProvider) {
        this.providers.set(provider.identifier, provider);
    }

    get(identifier: IntegrationProviderIdentifier): IIntegrationProvider {
        const provider = this.providers.get(identifier);
        if (!provider) {
            throw new Error(`Integration provider ${identifier} not found`);
        }
        return provider;
    }

    getAll(): IIntegrationProvider[] {
        return Array.from(this.providers.values());
    }
}

export const integrationRegistry = new IntegrationRegistry();

