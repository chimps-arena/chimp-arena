/**
 * Trivia question bank. Server-only: never import into a client component,
 * because it contains the answer keys. The /missions/trivia/start route sends
 * the client only the prompt + choices and keeps the answer key in the signed
 * start token.
 */

export interface TriviaQuestion {
  id: string;
  q: string;
  choices: string[];
  /** index into choices */
  answer: number;
  category: "solana" | "crypto" | "chimp" | "web3";
}

export const TRIVIA_BANK: TriviaQuestion[] = [
  {
    id: "sol-1",
    q: "What consensus mechanism is Solana best known for pioneering?",
    choices: ["Proof of History", "Proof of Work", "Proof of Burn", "Proof of Space"],
    answer: 0,
    category: "solana",
  },
  {
    id: "sol-2",
    q: "What is the smallest unit of SOL called?",
    choices: ["Wei", "Gwei", "Lamport", "Satoshi"],
    answer: 2,
    category: "solana",
  },
  {
    id: "sol-3",
    q: "Which wallet is the most popular browser extension for Solana?",
    choices: ["MetaMask", "Phantom", "Rainbow", "Keplr"],
    answer: 1,
    category: "solana",
  },
  {
    id: "sol-4",
    q: "Solana programs are most commonly written in which language?",
    choices: ["Solidity", "Move", "Rust", "Vyper"],
    answer: 2,
    category: "solana",
  },
  {
    id: "sol-5",
    q: "What is the name of Solana's token standard for fungible tokens?",
    choices: ["ERC-20", "SPL Token", "BEP-20", "TRC-20"],
    answer: 1,
    category: "solana",
  },
  {
    id: "sol-6",
    q: "Roughly how long is a Solana slot targeted to be?",
    choices: ["400 milliseconds", "2 seconds", "12 seconds", "1 minute"],
    answer: 0,
    category: "solana",
  },
  {
    id: "sol-7",
    q: "Which framework is the de facto standard for building Solana programs?",
    choices: ["Hardhat", "Anchor", "Foundry", "Truffle"],
    answer: 1,
    category: "solana",
  },
  {
    id: "cry-1",
    q: "What does 'HODL' originally come from?",
    choices: [
      "An acronym for 'Hold On for Dear Life'",
      "A misspelling of 'hold' in a forum post",
      "A trading bot named HODL",
      "A Bitcoin Core function",
    ],
    answer: 1,
    category: "crypto",
  },
  {
    id: "cry-2",
    q: "What is a 'rug pull'?",
    choices: [
      "A governance vote to change tokenomics",
      "A project's team abandoning it and taking investor funds",
      "A type of liquidity mining reward",
      "A hardware wallet recovery method",
    ],
    answer: 1,
    category: "crypto",
  },
  {
    id: "cry-3",
    q: "What does 'DYOR' stand for?",
    choices: [
      "Do Your Own Research",
      "Defend Your Owned Rewards",
      "Decentralized Yield On Register",
      "Don't Yield On Risk",
    ],
    answer: 0,
    category: "crypto",
  },
  {
    id: "cry-4",
    q: "An asset's 'market cap' is calculated as:",
    choices: [
      "Circulating supply multiplied by price",
      "Total volume over 24 hours",
      "Max supply minus burned tokens",
      "Liquidity pool depth times two",
    ],
    answer: 0,
    category: "crypto",
  },
  {
    id: "cry-5",
    q: "What is 'slippage' in a token swap?",
    choices: [
      "The network fee paid to validators",
      "The difference between expected and executed price",
      "The delay before a transaction confirms",
      "The spread between two exchanges",
    ],
    answer: 1,
    category: "crypto",
  },
  {
    id: "cry-6",
    q: "A 'whale' in crypto slang is:",
    choices: [
      "A validator with 100% uptime",
      "A holder with a very large position",
      "A stablecoin pegged to a basket",
      "An exchange listing bot",
    ],
    answer: 1,
    category: "crypto",
  },
  {
    id: "web3-1",
    q: "What is a 'seed phrase'?",
    choices: [
      "A password reset email",
      "A human-readable backup of a wallet's private key",
      "The first transaction on a chain",
      "A smart contract constructor argument",
    ],
    answer: 1,
    category: "web3",
  },
  {
    id: "web3-2",
    q: "Which of these should you NEVER share?",
    choices: [
      "Your public wallet address",
      "Your ENS or .sol domain",
      "Your private key / seed phrase",
      "A transaction signature hash",
    ],
    answer: 2,
    category: "web3",
  },
  {
    id: "web3-3",
    q: "What does signing a message with your wallet prove?",
    choices: [
      "That you control the wallet's private key",
      "That you have a positive token balance",
      "That your wallet is KYC verified",
      "That you paid a network fee",
    ],
    answer: 0,
    category: "web3",
  },
  {
    id: "web3-4",
    q: "An NFT is best described as:",
    choices: [
      "A token where every unit is interchangeable",
      "A uniquely identified on-chain token",
      "A wrapped version of a stablecoin",
      "A governance-only voting share",
    ],
    answer: 1,
    category: "web3",
  },
  {
    id: "web3-5",
    q: "'Gas' / network fees on a blockchain primarily pay for:",
    choices: [
      "Marketing the protocol",
      "Compute and storage used by a transaction",
      "The founder's treasury",
      "Bridging to other chains",
    ],
    answer: 1,
    category: "web3",
  },
  {
    id: "chimp-1",
    q: "In CHIMP Arena, individual XP feeds directly into what?",
    choices: ["Your crew's score", "A token airdrop", "Your gas rebate", "Nothing yet"],
    answer: 0,
    category: "chimp",
  },
  {
    id: "chimp-2",
    q: "How often can a single mission award XP?",
    choices: ["Once per hour", "Once per UTC day", "Unlimited", "Once per week"],
    answer: 1,
    category: "chimp",
  },
  {
    id: "chimp-3",
    q: "Which CHIMP Arena crew claims Astro Run as home turf?",
    choices: ["Banana Bloc", "Jungle Syndicate", "Rocket Primates", "Thunder Apes"],
    answer: 2,
    category: "chimp",
  },
  {
    id: "chimp-4",
    q: "What is the guiding priority of the CHIMP Arena MVP?",
    choices: [
      "Monetization first",
      "Adoption first, monetization later",
      "Token launch first",
      "NFT mint first",
    ],
    answer: 1,
    category: "chimp",
  },
  {
    id: "chimp-5",
    q: "How do you authenticate in CHIMP Arena?",
    choices: [
      "Email and password",
      "Connecting Phantom and signing a message",
      "A one-time SMS code",
      "An OAuth login with Google",
    ],
    answer: 1,
    category: "chimp",
  },
];

export function questionsForDay(seededOrder: string[], count = 5): TriviaQuestion[] {
  const byId = new Map(TRIVIA_BANK.map((q) => [q.id, q]));
  return seededOrder
    .map((id) => byId.get(id))
    .filter((q): q is TriviaQuestion => Boolean(q))
    .slice(0, count);
}
