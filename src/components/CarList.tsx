import { ICar } from "../interfaces/car";
import { CarStatus } from "../interfaces/car-status";
import { IRentACarContract } from "../interfaces/contract";
import { UserRole } from "../interfaces/user-role";
import { useStellarAccounts } from "../providers/StellarAccountProvider";
import { stellarService } from "../services/stellar.service";
import { walletService } from "../services/wallet.service";
import { shortenAddress } from "../utils/shorten-address";
import { ONE_XLM_IN_STROOPS } from "../utils/xlm-in-stroops";
import { useEffect, useState } from "react";

interface CarsListProps {
  cars: ICar[];
}

export const CarsList = ({ cars }: CarsListProps) => {
  const { walletAddress, selectedRole, setHashId, setCars } =
    useStellarAccounts();

  const [ownerBalances, setOwnerBalances] = useState<Record<string, number>>(
    {}
  );
  const [adminFee, setAdminFee] = useState<number>(0);

  const [showFeeModal, setShowFeeModal] = useState(false);
  const [newFee, setNewFee] = useState("");
  const openAdminFeeModal = () => setShowFeeModal(true);
  const closeAdminFeeModal = () => setShowFeeModal(false);
  const handleSaveAdminFee = async () => {
    const client =
      await stellarService.buildClient<IRentACarContract>(walletAddress);
    const result = await client.set_admin_fee({ fee: Number(newFee) });
    const xdr = result.toXDR();
    const signedTx = await walletService.signTransaction(xdr);
    await stellarService.submitTransaction(signedTx.signedTxXdr);
    setAdminFee(Number(newFee));
    closeAdminFeeModal();
    setNewFee("");
  };

  useEffect(() => {
    const fetchBalances = async () => {
      if (selectedRole !== UserRole.OWNER) {
        setOwnerBalances({});
        return;
      }
      const contractClient =
        await stellarService.buildClient<IRentACarContract>(walletAddress);
      const entries = await Promise.all(
        cars.map(async (c) => {
          try {
            const amt = await contractClient.get_owner_balance({
              owner: c.ownerAddress,
            });
            return [c.ownerAddress, Number(amt)] as const;
          } catch {
            return [c.ownerAddress, 0] as const;
          }
        })
      );
      setOwnerBalances(Object.fromEntries(entries));
    };
    void fetchBalances();
  }, [cars, selectedRole, walletAddress]);

  useEffect(() => {
    const fetchAdminFee = async () => {
      const client =
        await stellarService.buildClient<IRentACarContract>(walletAddress);
      try {
        const fee = await client.get_admin_fee();
        setAdminFee(Number(fee) * ONE_XLM_IN_STROOPS);
      } catch {
        setAdminFee(0);
      }
    };
    void fetchAdminFee();
  }, [walletAddress]);

  const handleDelete = async (owner: string) => {
    const contractClient =
      await stellarService.buildClient<IRentACarContract>(walletAddress);

    const result = await contractClient.remove_car({ owner });
    const xdr = result.toXDR();

    const signedTx = await walletService.signTransaction(xdr);
    const txHash = await stellarService.submitTransaction(signedTx.signedTxXdr);

    setCars((prev) => prev.filter((car) => car.ownerAddress !== owner));
    setOwnerBalances((prev) => ({ ...prev, [owner]: 0 }));
    setHashId(txHash as string);
  };

  const handlePayout = async (owner: string, amount: number) => {
    const contractClient =
      await stellarService.buildClient<IRentACarContract>(walletAddress);

    const result = await contractClient.payout_owner({ owner, amount });
    const xdr = result.toXDR();

    const signedTx = await walletService.signTransaction(xdr);
    const txHash = await stellarService.submitTransaction(signedTx.signedTxXdr);

    setHashId(txHash as string);
  };

  const handleRent = async (
    car: ICar,
    renter: string,
    totalDaysToRent: number
  ) => {
    const contractClient =
      await stellarService.buildClient<IRentACarContract>(walletAddress);

    const result = await contractClient.rental({
      renter,
      owner: car.ownerAddress,
      total_days_to_rent: totalDaysToRent,
      amount: car.pricePerDay * totalDaysToRent * ONE_XLM_IN_STROOPS,
    });
    const xdr = result.toXDR();

    const signedTx = await walletService.signTransaction(xdr);
    const txHash = await stellarService.submitTransaction(signedTx.signedTxXdr);

    setCars((prev) =>
      prev.map((c) =>
        c.ownerAddress === car.ownerAddress
          ? { ...c, status: CarStatus.RENTED }
          : c
      )
    );
    setHashId(txHash as string);
  };

  const getStatusStyle = (status: CarStatus) => {
    switch (status) {
      case CarStatus.AVAILABLE:
        return "px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800";
      case CarStatus.RENTED:
        return "px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800";
      case CarStatus.MAINTENANCE:
        return "px-2 py-1 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800";
      default:
        return "px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-800";
    }
  };

  const renderActionButton = (car: ICar) => {
    if (selectedRole === UserRole.ADMIN) {
      return (
        <div className="flex gap-2">
          <button
            onClick={() => void handleDelete(car.ownerAddress)}
            className="px-3 py-1 bg-red-600 text-white rounded font-semibold hover:bg-red-700 transition-colors cursor-pointer"
          >
            Delete
          </button>
          <button
            onClick={openAdminFeeModal}
            className="px-3 py-1 bg-purple-600 text-white rounded font-semibold hover:bg-purple-700 transition-colors cursor-pointer"
          >
            Set Fee
          </button>
        </div>
      );
    }

    if (selectedRole === UserRole.OWNER) {
      const available = ownerBalances[car.ownerAddress] ?? 0;
      const isAvailable = car.status === CarStatus.AVAILABLE;
      const disabled = !isAvailable || available <= 0;
      const btnClass = disabled
        ? "px-3 py-1 bg-gray-300 text-gray-600 rounded font-semibold cursor-not-allowed"
        : "px-3 py-1 bg-green-600 text-white rounded font-semibold hover:bg-green-700 transition-colors cursor-pointer";
      return (
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">Disponible: {available}</span>
          <button
            disabled={disabled}
            onClick={() => void handlePayout(car.ownerAddress, available)}
            className={btnClass}
            title={
              !isAvailable
                ? "El auto no está devuelto"
                : available <= 0
                  ? "Sin fondos disponibles"
                  : "Retirar fondos"
            }
          >
            Withdraw
          </button>
        </div>
      );
    }

    if (
      selectedRole === UserRole.RENTER &&
      car.status === CarStatus.AVAILABLE
    ) {
      const deposit = car.pricePerDay * 3 * ONE_XLM_IN_STROOPS;
      const total = deposit + adminFee;
      return (
        <div className="flex flex-col gap-1">
          <span className="text-xs text-gray-500">
            Depósito: {deposit} | Comisión: {adminFee} | Total: {total}
          </span>
          <button
            onClick={() => void handleRent(car, walletAddress, 3)}
            className="px-3 py-1 bg-blue-600 text-white rounded font-semibold hover:bg-blue-700 transition-colors cursor-pointer"
          >
            Rent ({total})
          </button>
        </div>
      );
    }

    return null;
  };

  return (
    <div data-test="cars-list">
      <div>
        <table className="min-w-full bg-white shadow-md rounded-lg">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Brand
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Model
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Color
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Passengers
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                A/C
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Owner
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Price/Day
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {cars.map((car, index) => (
              <tr key={index} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  {car.brand}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {car.model}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {car.color}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {car.passengers}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {car.ac ? (
                    <span className="text-green-600">Yes</span>
                  ) : (
                    <span className="text-red-600">No</span>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {shortenAddress(car.ownerAddress)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  ${car.pricePerDay}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  <span className={getStatusStyle(car.status)}>
                    {car.status}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {renderActionButton(car)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {showFeeModal && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white p-4 rounded shadow-md w-80">
            <h3 className="font-bold mb-2">Set Admin Fee (XLM)</h3>
            <input
              value={newFee}
              onChange={(e) => setNewFee(e.target.value)}
              type="number"
              className="border w-full px-2 py-1 mb-3"
              placeholder="e.g. 200"
              min={0}
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={closeAdminFeeModal}
                className="px-3 py-1 bg-gray-300 rounded"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveAdminFee}
                className="px-3 py-1 bg-purple-600 text-white rounded"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
