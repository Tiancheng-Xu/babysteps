import {
	afterEach,
	assert,
	clearStore,
  describe,
  newMockEvent,
  test,
} from "matchstick-as/assembly/index";
import { Address, BigInt, Bytes, ethereum } from "@graphprotocol/graph-ts";
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
  handleCertificateMinted,
  handleCompletionConfirmed,
	handlePurchaseCreated,
	handleRoleGranted,
	handleRoleRevoked,
	handleTaskApproved,
	handleTaskPauseChanged,
	handleTaskRandomized,
	handleTaskRejected,
  handleTaskRequested,
} from "../src/task-marketplace";

const provider = Address.fromString("0x1111111111111111111111111111111111111111");
const payee = Address.fromString("0x2222222222222222222222222222222222222222");
const buyer = Address.fromString("0x3333333333333333333333333333333333333333");
const metadataHash = Bytes.fromHexString(`0x${"ab".repeat(32)}`);
const evidenceHash = Bytes.fromHexString(`0x${"cd".repeat(32)}`);
const providerRole = Bytes.fromHexString(`0x${"ef".repeat(32)}`);

function taskRequested(): TaskRequested {
  const event = changetype<TaskRequested>(newMockEvent());
  event.parameters = [
    new ethereum.EventParam("taskId", ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(1))),
    new ethereum.EventParam("provider", ethereum.Value.fromAddress(provider)),
    new ethereum.EventParam("payee", ethereum.Value.fromAddress(payee)),
    new ethereum.EventParam("activityType", ethereum.Value.fromI32(2)),
    new ethereum.EventParam("metadataUri", ethereum.Value.fromString("ipfs://task/1")),
    new ethereum.EventParam("metadataHash", ethereum.Value.fromFixedBytes(metadataHash)),
  ];
  return event;
}

function taskApproved(): TaskApproved {
  const event = changetype<TaskApproved>(newMockEvent());
  event.parameters = [
    new ethereum.EventParam("taskId", ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(1))),
    new ethereum.EventParam("requestId", ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(9))),
    new ethereum.EventParam("owner", ethereum.Value.fromAddress(provider)),
  ];
  return event;
}

function taskRandomized(): TaskRandomized {
  const event = changetype<TaskRandomized>(newMockEvent());
  event.parameters = [
    new ethereum.EventParam("taskId", ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(1))),
    new ethereum.EventParam("requestId", ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(9))),
    new ethereum.EventParam("price", ethereum.Value.fromUnsignedBigInt(BigInt.fromString("4000000000000000000"))),
    new ethereum.EventParam("opensAt", ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(1000))),
    new ethereum.EventParam("closesAt", ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(15400))),
  ];
  return event;
}

function purchaseCreated(): PurchaseCreated {
  const event = changetype<PurchaseCreated>(newMockEvent());
  event.parameters = [
    new ethereum.EventParam("purchaseId", ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(7))),
    new ethereum.EventParam("taskId", ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(1))),
    new ethereum.EventParam("buyer", ethereum.Value.fromAddress(buyer)),
    new ethereum.EventParam("price", ethereum.Value.fromUnsignedBigInt(BigInt.fromString("4000000000000000000"))),
    new ethereum.EventParam("purchasedAt", ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(1200))),
  ];
  return event;
}

function completionConfirmed(): CompletionConfirmed {
  const event = changetype<CompletionConfirmed>(newMockEvent());
  event.parameters = [
    new ethereum.EventParam("purchaseId", ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(7))),
    new ethereum.EventParam("taskId", ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(1))),
    new ethereum.EventParam("buyer", ethereum.Value.fromAddress(buyer)),
    new ethereum.EventParam("evidenceHash", ethereum.Value.fromFixedBytes(evidenceHash)),
  ];
  return event;
}

function certificateMinted(): CertificateMinted {
  const event = changetype<CertificateMinted>(newMockEvent());
  event.parameters = [
    new ethereum.EventParam("purchaseId", ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(7))),
    new ethereum.EventParam("tokenId", ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(3))),
    new ethereum.EventParam("recipient", ethereum.Value.fromAddress(buyer)),
  ];
  return event;
}

function roleGranted(): RoleGranted {
	const event = changetype<RoleGranted>(newMockEvent());
	event.parameters = [
		new ethereum.EventParam(
			"role",
			ethereum.Value.fromFixedBytes(providerRole),
		),
		new ethereum.EventParam("account", ethereum.Value.fromAddress(provider)),
		new ethereum.EventParam("sender", ethereum.Value.fromAddress(payee)),
	];
	return event;
}

function roleRevoked(): RoleRevoked {
	const event = changetype<RoleRevoked>(newMockEvent());
	event.parameters = roleGranted().parameters;
	return event;
}

function taskRejected(): TaskRejected {
	const event = changetype<TaskRejected>(newMockEvent());
	event.parameters = [
		new ethereum.EventParam(
			"taskId",
			ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(1)),
		),
		new ethereum.EventParam("owner", ethereum.Value.fromAddress(payee)),
		new ethereum.EventParam(
			"reasonHash",
			ethereum.Value.fromFixedBytes(evidenceHash),
		),
	];
	return event;
}

function taskPaused(): TaskPauseChanged {
	const event = changetype<TaskPauseChanged>(newMockEvent());
	event.parameters = [
		new ethereum.EventParam(
			"taskId",
			ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(1)),
		),
		new ethereum.EventParam("paused", ethereum.Value.fromBoolean(true)),
	];
	return event;
}

describe("TaskMarketplaceV2 indexing", () => {
  afterEach(() => clearStore());

  test("indexes the task review and random activation lifecycle", () => {
    handleTaskRequested(taskRequested());
    handleTaskApproved(taskApproved());
    handleTaskRandomized(taskRandomized());

    assert.entityCount("Task", 1);
    assert.fieldEquals("Task", "1", "provider", provider.toHexString());
    assert.fieldEquals("Task", "1", "metadataUri", "ipfs://task/1");
    assert.fieldEquals("Task", "1", "requestId", "9");
    assert.fieldEquals("Task", "1", "status", "ACTIVE");
    assert.fieldEquals("Task", "1", "price", "4000000000000000000");
    assert.fieldEquals("Task", "1", "closesAt", "15400");
  });

	test("links purchase, completion, and certificate without duplicating entities", () => {
    handleTaskRequested(taskRequested());
    handlePurchaseCreated(purchaseCreated());
    handleCompletionConfirmed(completionConfirmed());
    handleCertificateMinted(certificateMinted());
    handleCertificateMinted(certificateMinted());

    assert.entityCount("Purchase", 1);
    assert.fieldEquals("Purchase", "7", "task", "1");
    assert.fieldEquals("Purchase", "7", "buyer", buyer.toHexString());
    assert.fieldEquals("Purchase", "7", "completed", "true");
    assert.fieldEquals("Purchase", "7", "evidenceHash", evidenceHash.toHexString());
    assert.entityCount("Certificate", 1);
    assert.fieldEquals("Certificate", "3", "purchase", "7");
		assert.fieldEquals("Purchase", "7", "certificate", "3");
	});

	test("tracks role revocation as the latest assignment state", () => {
		handleRoleGranted(roleGranted());
		handleRoleRevoked(roleRevoked());

		const id = providerRole.toHexString() + "-" + provider.toHexString();
		assert.entityCount("RoleAssignment", 1);
		assert.fieldEquals("RoleAssignment", id, "active", "false");
		assert.fieldEquals(
			"RoleAssignment",
			id,
			"account",
			provider.toHexString(),
		);
	});

	test("indexes rejection and pause state changes", () => {
		handleTaskRequested(taskRequested());
		handleTaskRejected(taskRejected());
		assert.fieldEquals("Task", "1", "status", "REJECTED");
		assert.fieldEquals(
			"Task",
			"1",
			"rejectionReasonHash",
			evidenceHash.toHexString(),
		);

		clearStore();
		handleTaskRequested(taskRequested());
		handleTaskPauseChanged(taskPaused());
		assert.fieldEquals("Task", "1", "paused", "true");
	});
});
