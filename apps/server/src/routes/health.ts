import { FastifyInstance } from 'fastify';
import { getChainId, MEGAETH_TESTNET_CHAIN_ID } from '../blockchain.js';

export async function healthRoutes(fastify: FastifyInstance) {
  fastify.get('/health', async (request, reply) => {
    try {
      const chainId = await getChainId();

      // Verify we're on the expected chain
      if (chainId !== MEGAETH_TESTNET_CHAIN_ID) {
        fastify.log.warn(
          `Unexpected chain ID: ${chainId}. Expected ${MEGAETH_TESTNET_CHAIN_ID} (MegaETH testnet)`
        );
      }

      return {
        ok: true,
        chainId,
        network: chainId === MEGAETH_TESTNET_CHAIN_ID ? 'MegaETH Testnet' : 'Unknown',
      };
    } catch (error) {
      fastify.log.error({ err: error }, 'Health check failed');
      return reply.status(503).send({
        ok: false,
        error: 'Failed to connect to blockchain',
      });
    }
  });
}

