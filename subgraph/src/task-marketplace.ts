import {
  CertificateMinted,
  CompletionConfirmed,
  PurchaseCreated,
  RoleGranted,
  RoleRevoked,
  TaskApproved,
  TaskPauseChanged,
  TaskRandomized,
  TaskRejected,
  TaskRequested,
} from "../generated/TaskMarketplaceV2/TaskMarketplaceV2";
import {
  Certificate,
  Purchase,
  RoleAssignment,
  Task,
} from "../generated/schema";

function roleAssignmentId(role: string, account: string): string {
  return role + "-" + account;
}

export function handleRoleGranted(event: RoleGranted): void {
	const id = roleAssignmentId(
		event.params.role.toHexString(),
		event.params.account.toHexString(),
	);
	let assignment = RoleAssignment.load(id);
	if (assignment === null) assignment = new RoleAssignment(id);
	assignment.role = event.params.role;
	assignment.account = event.params.account;
	assignment.sender = event.params.sender;
	assignment.active = true;
	assignment.updatedAt = event.block.timestamp;
	assignment.updatedBlock = event.block.number;
	assignment.transactionHash = event.transaction.hash;
	assignment.save();
}

export function handleRoleRevoked(event: RoleRevoked): void {
	const id = roleAssignmentId(
		event.params.role.toHexString(),
		event.params.account.toHexString(),
	);
	let assignment = RoleAssignment.load(id);
	if (assignment === null) assignment = new RoleAssignment(id);
	assignment.role = event.params.role;
	assignment.account = event.params.account;
	assignment.sender = event.params.sender;
	assignment.active = false;
	assignment.updatedAt = event.block.timestamp;
	assignment.updatedBlock = event.block.number;
	assignment.transactionHash = event.transaction.hash;
	assignment.save();
}

export function handleTaskRequested(event: TaskRequested): void {
  const id = event.params.taskId.toString();
  const task = new Task(id);
  task.provider = event.params.provider;
  task.payee = event.params.payee;
  task.activityType = event.params.activityType;
  task.metadataUri = event.params.metadataUri;
  task.metadataHash = event.params.metadataHash;
  task.status = "PENDING_REVIEW";
  task.paused = false;
  task.createdAt = event.block.timestamp;
  task.createdBlock = event.block.number;
  task.updatedAt = event.block.timestamp;
  task.updatedBlock = event.block.number;
  task.transactionHash = event.transaction.hash;
  task.save();
}

export function handleTaskApproved(event: TaskApproved): void {
  const task = Task.load(event.params.taskId.toString());
  if (task === null) return;
  task.requestId = event.params.requestId;
  task.status = "PENDING_RANDOMNESS";
  task.updatedAt = event.block.timestamp;
  task.updatedBlock = event.block.number;
  task.transactionHash = event.transaction.hash;
  task.save();
}

export function handleTaskRejected(event: TaskRejected): void {
	const task = Task.load(event.params.taskId.toString());
	if (task === null) return;
	task.rejectionReasonHash = event.params.reasonHash;
	task.status = "REJECTED";
	task.updatedAt = event.block.timestamp;
	task.updatedBlock = event.block.number;
	task.transactionHash = event.transaction.hash;
	task.save();
}

export function handleTaskRandomized(event: TaskRandomized): void {
  const task = Task.load(event.params.taskId.toString());
  if (task === null) return;
  task.requestId = event.params.requestId;
  task.price = event.params.price;
  task.opensAt = event.params.opensAt;
  task.closesAt = event.params.closesAt;
  task.status = "ACTIVE";
  task.updatedAt = event.block.timestamp;
  task.updatedBlock = event.block.number;
  task.transactionHash = event.transaction.hash;
  task.save();
}

export function handleTaskPauseChanged(event: TaskPauseChanged): void {
	const task = Task.load(event.params.taskId.toString());
	if (task === null) return;
	task.paused = event.params.paused;
	task.updatedAt = event.block.timestamp;
	task.updatedBlock = event.block.number;
	task.transactionHash = event.transaction.hash;
	task.save();
}

export function handlePurchaseCreated(event: PurchaseCreated): void {
  const id = event.params.purchaseId.toString();
  const purchase = new Purchase(id);
  purchase.task = event.params.taskId.toString();
  purchase.buyer = event.params.buyer;
  purchase.price = event.params.price;
  purchase.purchasedAt = event.params.purchasedAt;
  purchase.completed = false;
  purchase.updatedAt = event.block.timestamp;
  purchase.updatedBlock = event.block.number;
  purchase.transactionHash = event.transaction.hash;
  purchase.save();
}

export function handleCompletionConfirmed(event: CompletionConfirmed): void {
  const purchase = Purchase.load(event.params.purchaseId.toString());
  if (purchase === null) return;
  purchase.completed = true;
  purchase.evidenceHash = event.params.evidenceHash;
  purchase.updatedAt = event.block.timestamp;
  purchase.updatedBlock = event.block.number;
  purchase.transactionHash = event.transaction.hash;
  purchase.save();
}

export function handleCertificateMinted(event: CertificateMinted): void {
  const purchaseId = event.params.purchaseId.toString();
  const purchase = Purchase.load(purchaseId);
  if (purchase === null) return;

  const certificateId = event.params.tokenId.toString();
  let certificate = Certificate.load(certificateId);
  if (certificate === null) {
    certificate = new Certificate(certificateId);
    certificate.purchase = purchaseId;
    certificate.tokenId = event.params.tokenId;
    certificate.recipient = event.params.recipient;
    certificate.mintedAt = event.block.timestamp;
    certificate.mintedBlock = event.block.number;
    certificate.transactionHash = event.transaction.hash;
    certificate.save();
  }

  purchase.certificate = certificateId;
  purchase.updatedAt = event.block.timestamp;
  purchase.updatedBlock = event.block.number;
  purchase.transactionHash = event.transaction.hash;
  purchase.save();
}
