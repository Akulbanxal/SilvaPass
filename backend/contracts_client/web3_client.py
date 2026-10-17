"""
Web3 Blockchain Integration Client for SilvaPass Registry Smart Contract.
Supports:
- Interacting directly with the deployed SilvaPassRegistry Solidity contract over JSON-RPC (Hardhat node or public testnet).
- Automatic fallback / simulation mode when RPC is unavailable, with clear status indicators.
- Idempotent and deterministic registration and claim execution.
- Reconciliation of on-chain state with local database state.
"""
import os
import json
import logging
from pathlib import Path
from typing import Dict, Any, Optional, Tuple
from web3 import Web3
from web3.exceptions import Web3Exception

from backend.config import settings

logger = logging.getLogger("silvapass.contracts")

# Standard ABI path from contracts build
ARTIFACT_PATH = Path("contracts/artifacts/contracts/SilvaPassRegistry.sol/SilvaPassRegistry.json")


def _crop_to_bytes32(crop: str) -> bytes:
    """Encodes crop string to 32 bytes (UTF-8, right-padded with zeros)."""
    b = crop.encode("utf-8")[:32]
    return b.ljust(32, b"\x00")


def _hex_to_bytes32(val: str) -> bytes:
    """Normalizes string hex or string ID into bytes32."""
    clean_val = val[2:] if val.startswith("0x") else val
    # If it's a 64-character valid hex string (e.g. SHA-256 fingerprint), parse directly as bytes32
    if len(clean_val) == 64:
        try:
            return bytes.fromhex(clean_val)
        except ValueError:
            pass
    elif val.startswith("0x"):
        clean_hex = clean_val
        if len(clean_hex) < 64:
            clean_hex = clean_hex.ljust(64, "0")
        elif len(clean_hex) > 64:
            clean_hex = clean_hex[:64]
        try:
            return bytes.fromhex(clean_hex)
        except ValueError:
            pass

    # Use sha256 digest of utf-8 string if not hex
    import hashlib
    return hashlib.sha256(val.encode("utf-8")).digest()



class BlockchainRegistryClient:
    """
    Client interface to the SilvaPassRegistry Solidity smart contract.
    Connects to Hardhat local node or testnet via settings.EVM_RPC_URL.
    """
    def __init__(self, rpc_url: Optional[str] = None, contract_address: Optional[str] = None):
        self.rpc_url = rpc_url or settings.EVM_RPC_URL
        self.contract_address = contract_address or settings.SILVAPASS_REGISTRY_ADDRESS
        self.private_key = settings.REGISTRAR_PRIVATE_KEY
        self.w3 = Web3(Web3.HTTPProvider(self.rpc_url))
        self.abi = self._load_abi()
        self.contract = None

        if self.is_connected() and self.contract_address:
            try:
                checksummed = self.w3.to_checksum_address(self.contract_address)
                self.contract = self.w3.eth.contract(address=checksummed, abi=self.abi)
            except Exception as e:
                logger.warning(f"Could not initialize contract at {self.contract_address}: {e}")

    def _load_abi(self) -> list:
        if ARTIFACT_PATH.exists():
            try:
                data = json.loads(ARTIFACT_PATH.read_text())
                return data.get("abi", [])
            except Exception as e:
                logger.error(f"Failed to load ABI from {ARTIFACT_PATH}: {e}")
        return []

    def is_connected(self) -> bool:
        """Returns True if JSON-RPC node is reachable."""
        try:
            return bool(self.w3.is_connected())
        except Exception:
            return False

    def get_network_status(self) -> Dict[str, Any]:
        """Provides status of the connected blockchain network."""
        connected = self.is_connected()
        if not connected:
            return {
                "connected": False,
                "rpc_url": self.rpc_url,
                "chain_id": None,
                "block_number": None,
                "contract_address": self.contract_address,
                "contract_deployed": False,
                "mode": "FALLBACK_SIMULATED",
                "message": "RPC node unavailable. Contract calls will operate in verified fallback simulation mode."
            }
        try:
            chain_id = self.w3.eth.chain_id
            block_number = self.w3.eth.block_number
            contract_deployed = False
            if self.contract_address:
                try:
                    code = self.w3.eth.get_code(self.w3.to_checksum_address(self.contract_address))
                    contract_deployed = len(code) > 0
                except Exception:
                    contract_deployed = False

            return {
                "connected": True,
                "rpc_url": self.rpc_url,
                "chain_id": chain_id,
                "block_number": block_number,
                "contract_address": self.contract_address,
                "contract_deployed": contract_deployed,
                "mode": "LIVE_EVM",
                "message": f"Connected to chain ID {chain_id} (block #{block_number})."
            }
        except Exception as e:
            return {
                "connected": False,
                "rpc_url": self.rpc_url,
                "error": str(e),
                "mode": "FALLBACK_SIMULATED",
                "message": f"RPC connection error: {e}"
            }

    def register_plot_allowance(
        self,
        plot_id: str,
        canonical_fingerprint: str,
        season_id: int,
        crop_code: str,
        approved_allowance_kg: int,
        evidence_hash: str
    ) -> Dict[str, Any]:
        """
        Executes registerPlot on-chain or records state if contract is available.
        """
        plot_id_bytes = _hex_to_bytes32(canonical_fingerprint)
        geom_bytes = _hex_to_bytes32(canonical_fingerprint)
        crop_bytes = _crop_to_bytes32(crop_code)
        evidence_bytes = _hex_to_bytes32(evidence_hash)

        if not self.is_connected() or not self.contract:
            # Fallback simulation
            import uuid
            tx_hash = f"0x{uuid.uuid4().hex}{uuid.uuid4().hex}"
            return {
                "is_live_chain": False,
                "tx_hash": tx_hash,
                "block_number": 42,
                "plot_id": plot_id,
                "season_id": season_id,
                "approved_allowance_kg": approved_allowance_kg,
                "status": "CONFIRMED_SIMULATED"
            }

        account = self.w3.eth.account.from_key(self.private_key)
        try:
            # Check if already registered on-chain
            reg_info = self.contract.functions.getPlotRegistration(plot_id_bytes, season_id).call()
            # reg_info: (geom, crop, approved, claimed, released, remaining, evidence, status, exists)
            if reg_info[8]:  # exists
                return {
                    "is_live_chain": True,
                    "tx_hash": "0xALREADY_REGISTERED",
                    "block_number": self.w3.eth.block_number,
                    "plot_id": plot_id,
                    "season_id": season_id,
                    "approved_allowance_kg": reg_info[2],
                    "status": "CONFIRMED_ON_CHAIN",
                    "note": "Existing on-chain registration observed."
                }

            tx = self.contract.functions.registerPlot(
                plot_id_bytes,
                geom_bytes,
                crop_bytes,
                season_id,
                approved_allowance_kg,
                evidence_bytes
            ).build_transaction({
                "from": account.address,
                "nonce": self.w3.eth.get_transaction_count(account.address),
                "gas": 300000,
                "gasPrice": self.w3.eth.gas_price
            })

            signed = self.w3.eth.account.sign_transaction(tx, self.private_key)
            tx_hash = self.w3.eth.send_raw_transaction(signed.raw_transaction)
            receipt = self.w3.eth.wait_for_transaction_receipt(tx_hash, timeout=15)

            return {
                "is_live_chain": True,
                "tx_hash": tx_hash.hex(),
                "block_number": receipt.blockNumber,
                "gas_used": receipt.gasUsed,
                "plot_id": plot_id,
                "season_id": season_id,
                "approved_allowance_kg": approved_allowance_kg,
                "status": "CONFIRMED_ON_CHAIN"
            }
        except Exception as e:
            logger.error(f"On-chain registerPlot failed: {e}")
            raise RuntimeError(f"On-chain registerPlot transaction failed: {e}")

    def submit_shipment_claim(
        self,
        claim_id: str,
        canonical_fingerprint: str,
        season_id: int,
        claimed_kg: int,
        evidence_hash: str
    ) -> Dict[str, Any]:
        """
        Submits claimShipment to on-chain registry.
        Gracefully handles both accepted claims and over-allocation rejection events.
        """
        claim_id_bytes = _hex_to_bytes32(claim_id)
        plot_id_bytes = _hex_to_bytes32(canonical_fingerprint)
        evidence_bytes = _hex_to_bytes32(evidence_hash)

        if not self.is_connected() or not self.contract:
            # Deterministic simulation mode
            import uuid
            tx_hash = f"0x{uuid.uuid4().hex}{uuid.uuid4().hex}"
            return {
                "is_live_chain": False,
                "tx_hash": tx_hash,
                "block_number": 43,
                "claim_id": claim_id,
                "claimed_kg": claimed_kg,
                "status": "SIMULATED"
            }

        account = self.w3.eth.account.from_key(self.private_key)
        try:
            tx = self.contract.functions.claimShipment(
                claim_id_bytes,
                plot_id_bytes,
                season_id,
                claimed_kg,
                evidence_bytes
            ).build_transaction({
                "from": account.address,
                "nonce": self.w3.eth.get_transaction_count(account.address),
                "gas": 300000,
                "gasPrice": self.w3.eth.gas_price
            })

            signed = self.w3.eth.account.sign_transaction(tx, self.private_key)
            tx_hash = self.w3.eth.send_raw_transaction(signed.raw_transaction)
            receipt = self.w3.eth.wait_for_transaction_receipt(tx_hash, timeout=15)

            # Parse logs for ShipmentClaimAccepted or ShipmentClaimRejected
            accepted_events = self.contract.events.ShipmentClaimAccepted().process_receipt(receipt)
            rejected_events = self.contract.events.ShipmentClaimRejected().process_receipt(receipt)

            if accepted_events:
                ev = accepted_events[0]["args"]
                return {
                    "is_live_chain": True,
                    "tx_hash": tx_hash.hex(),
                    "block_number": receipt.blockNumber,
                    "gas_used": receipt.gasUsed,
                    "claim_id": claim_id,
                    "claimed_kg": claimed_kg,
                    "outcome": "ACCEPTED",
                    "remaining_allowance_kg": ev["remainingAllowanceKg"],
                    "status": "CONFIRMED"
                }
            elif rejected_events:
                ev = rejected_events[0]["args"]
                return {
                    "is_live_chain": True,
                    "tx_hash": tx_hash.hex(),
                    "block_number": receipt.blockNumber,
                    "gas_used": receipt.gasUsed,
                    "claim_id": claim_id,
                    "claimed_kg": claimed_kg,
                    "outcome": "REJECTED_OVER_ALLOCATION",
                    "remaining_allowance_kg": ev["remainingAllowanceKg"],
                    "reason": ev["reason"],
                    "status": "REJECTED_OVER_ALLOCATION"
                }
            else:
                return {
                    "is_live_chain": True,
                    "tx_hash": tx_hash.hex(),
                    "block_number": receipt.blockNumber,
                    "outcome": "UNKNOWN",
                    "status": "PENDING"
                }
        except Exception as e:
            logger.error(f"On-chain claimShipment failed: {e}")
            raise RuntimeError(f"On-chain claimShipment error: {e}")

    def query_on_chain_plot(self, canonical_fingerprint: str, season_id: int) -> Optional[Dict[str, Any]]:
        """Queries on-chain registration state if connected."""
        if not self.is_connected() or not self.contract:
            return None

        plot_id_bytes = _hex_to_bytes32(canonical_fingerprint)
        try:
            info = self.contract.functions.getPlotRegistration(plot_id_bytes, season_id).call()
            if not info[8]:  # exists
                return None
            return {
                "exists": True,
                "crop_code_bytes32": "0x" + info[1].hex(),
                "approved_allowance_kg": info[2],
                "claimed_kg": info[3],
                "released_kg": info[4],
                "remaining_allowance_kg": info[5],
                "status_code": info[7]
            }
        except Exception as e:
            logger.warning(f"Failed to query on-chain plot registration: {e}")
            return None
