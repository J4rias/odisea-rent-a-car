export const shortenAddress = (address: string) => {
  if (!address) return "";
  const first = address.slice(0, 4);
  const last = address.slice(-4);
  return `${first}...${last}`;
};

// CAEXI5CEXWN36XP4M7ZCNT26BMO4T3LQPQKPJEECVCIV4PR236CK3YQ6