export function spvStructureParagraph(assetType: string): string {
  if (assetType === "AGRICULTURE") {
    return (
      "Interests are typically issued through a land-holding SPV or trust that holds lease, crop, or revenue agreements. " +
      "Your on-chain receipt maps to the subscription terms in the issuer’s offering documents—not direct title to soil unless the deal pack explicitly says so."
    );
  }
  return (
    "Interests are typically issued through a bankruptcy-remote SPV that holds the property asset or lease stack. " +
    "Tokens represent contractual rights against that structure as described in the private placement materials."
  );
}

export function ownershipRightsParagraph(): string {
  return (
    "Unless the offering states otherwise, tokens are not direct evidence of deed or share certificates. " +
    "They evidence beneficial or economic participation under the issuer’s subscription agreement and any transfer restrictions therein."
  );
}
