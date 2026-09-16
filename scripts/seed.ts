import { db } from '../src/lib/db';
import { hashPassword } from '../src/lib/auth';

const VENDORS = ['Acme Corp', 'TechVision Ltd', 'CloudStack Inc', 'DataFlow Systems', 'NetSecure GmbH'];

const STATUSES = ['pass', 'warning', 'fail'] as const;
const APPROVAL_STATUSES = ['none', 'pending_review', 'approved', 'auto_approved'] as const;
const LIFECYCLE_STATUSES = ['pending', 'approved', 'exported', 'paid'] as const;

type Plan = 'free' | 'pro' | 'plus' | 'business' | 'enterprise';

interface TestUser {
  email: string;
  name: string;
  plan: Plan;
}

const TEST_USERS: TestUser[] = [
  { email: 'free@omniparse.test', name: 'Free User', plan: 'free' },
  { email: 'pro@omniparse.test', name: 'Pro User', plan: 'pro' },
  { email: 'plus@omniparse.test', name: 'Plus User', plan: 'plus' },
  { email: 'business@omniparse.test', name: 'Business User', plan: 'business' },
  { email: 'enterprise@omniparse.test', name: 'Enterprise User', plan: 'enterprise' },
];

function randomFloat(min: number, max: number, decimals = 2): number {
  return Math.round((Math.random() * (max - min) + min) * Math.pow(10, decimals)) / Math.pow(10, decimals);
}

function randomDate(daysBack: number): string {
  const now = new Date();
  const past = new Date(now.getTime() - Math.random() * daysBack * 24 * 60 * 60 * 1000);
  return past.toISOString().split('T')[0];
}

function randomDueDate(invDate: string): string {
  const d = new Date(invDate);
  d.setDate(d.getDate() + 30 + Math.floor(Math.random() * 15));
  return d.toISOString().split('T')[0];
}

function randomFrom<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateLineItems(count: number) {
  const items = [
    { description: 'Cloud hosting service', quantity: 1, unitPrice: 299.99 },
    { description: 'API calls - 10k pack', quantity: 3, unitPrice: 49.99 },
    { description: 'SSL certificate renewal', quantity: 1, unitPrice: 79.99 },
    { description: 'Consulting hours', quantity: 10, unitPrice: 150.00 },
    { description: 'Software license - annual', quantity: 1, unitPrice: 1200.00 },
    { description: 'Data storage - 1TB', quantity: 2, unitPrice: 99.99 },
    { description: 'Technical support - monthly', quantity: 1, unitPrice: 500.00 },
    { description: 'Domain registration', quantity: 5, unitPrice: 12.99 },
    { description: 'Network equipment', quantity: 1, unitPrice: 2450.00 },
    { description: 'Security audit', quantity: 1, unitPrice: 3500.00 },
    { description: 'Training session', quantity: 2, unitPrice: 750.00 },
    { description: 'Migration service', quantity: 1, unitPrice: 4500.00 },
  ];

  const shuffled = items.sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count).map((item) => ({
    ...item,
    unitTotal: Math.round(item.quantity * item.unitPrice * 100) / 100,
  }));
}

function generateFieldConfidence(confidence: number) {
  return {
    vendor: randomFloat(confidence - 0.05, confidence + 0.02),
    invoiceNumber: randomFloat(confidence - 0.03, confidence + 0.01),
    invoiceDate: randomFloat(confidence - 0.08, confidence + 0.02),
    dueDate: randomFloat(confidence - 0.1, confidence + 0.02),
    amount: randomFloat(confidence - 0.04, confidence + 0.01),
    vatAmount: randomFloat(confidence - 0.06, confidence + 0.01),
    total: randomFloat(confidence - 0.03, confidence + 0.01),
    currency: randomFloat(0.95, 1.0),
  };
}

function generateValidationResults(status: string) {
  return {
    status,
    rules: [
      { rule: 'vendor_present', status: 'pass', message: 'Vendor is present' },
      { rule: 'invoice_number_present', status: Math.random() > 0.3 ? 'pass' : 'warn', message: 'Invoice number check' },
      { rule: 'amount_positive', status: status === 'fail' && Math.random() > 0.5 ? 'reject' : 'pass', message: 'Amount positivity check' },
    ],
    varianceChecks: [],
    tamperingCheck: { isSuspicious: false, checks: [] },
  };
}

async function createInvoices(userId: string, count: number) {
  const invoices = [];
  for (let i = 0; i < count; i++) {
    const vendor = randomFrom(VENDORS);
    const invDate = randomDate(90);
    const dueDate = randomDueDate(invDate);
    const amount = randomFloat(150, 15000);
    const vatAmount = Math.round(amount * (0.18 + Math.random() * 0.07) * 100) / 100;
    const total = Math.round((amount + vatAmount) * 100) / 100;
    const confidence = randomFloat(0.75, 0.99);
    const validationStatus = randomFrom(STATUSES);
    const isDuplicate = Math.random() > 0.8;
    const approvalStatus = Math.random() > 0.6
      ? randomFrom(APPROVAL_STATUSES.slice(1))
      : 'none';
    const lifecycleStatus = randomFrom(LIFECYCLE_STATUSES);
    const lineItemCount = 1 + Math.floor(Math.random() * 4);
    const lineItems = generateLineItems(lineItemCount);

    const inv = await db.invoice.create({
      data: {
        userId,
        filename: `invoice_${vendor.replace(/\s+/g, '_')}_${i + 1}.pdf`,
        vendor,
        invNumber: `INV-${String(1000 + i).padStart(4, '0')}`,
        invDate,
        dueDate,
        amount,
        vatAmount,
        total,
        currency: Math.random() > 0.7 ? 'EUR' : 'USD',
        status: validationStatus === 'fail' ? 'review' : confidence >= 0.85 ? 'done' : 'review',
        isDuplicate,
        confidence,
        fieldConfidence: generateFieldConfidence(confidence),
        validationResults: generateValidationResults(validationStatus),
        validationStatus,
        lineItems,
        processingTime: randomFloat(1.5, 8.0),
        approvalStatus,
        lifecycleStatus,
        ...(approvalStatus === 'approved' ? {
          approvedBy: userId,
          approvedAt: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000),
          approvalNote: 'Reviewed and approved',
        } : {}),
        createdAt: new Date(Date.now() - Math.random() * 90 * 24 * 60 * 60 * 1000),
      },
    });
    invoices.push(inv);
  }
  return invoices;
}

async function main() {
  console.log('🌱 Seeding database...');

  // Create test users
  const users: Record<string, { id: string; plan: Plan }> = {};
  for (const u of TEST_USERS) {
    await db.user.deleteMany({ where: { email: u.email } });
    const passwordHash = await hashPassword('Test1234');
    const user = await db.user.create({
      data: {
        email: u.email,
        name: u.name,
        password: passwordHash,
        plan: u.plan,
      },
    });
    users[u.email] = { id: user.id, plan: u.plan };
    console.log(`  ✓ Created ${u.email} (${u.plan})`);
  }

  // Create invoices
  const invoiceCounts: Record<string, number> = {
    'pro@omniparse.test': 10,
    'plus@omniparse.test': 12,
    'business@omniparse.test': 15,
    'enterprise@omniparse.test': 8,
  };

  for (const [email, count] of Object.entries(invoiceCounts)) {
    const { id } = users[email];
    const invoices = await createInvoices(id, count);
    console.log(`  ✓ Created ${invoices.length} invoices for ${email}`);

    const auditActions = ['viewed', 'edited', 'approved'];
    const logCount = Math.min(5, invoices.length);
    for (let i = 0; i < logCount; i++) {
      const inv = invoices[i];
      const action = auditActions[i % auditActions.length];
      await db.auditLog.create({
        data: {
          userId: id,
          invoiceId: inv.id,
          action,
          details: action === 'viewed' ? {} : action === 'edited' ? { field: 'status', newValue: 'done' } : { note: 'Looks good' },
          createdAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000),
        },
      });
    }
    console.log(`  ✓ Created ${logCount} audit logs for ${email}`);
  }

  // Approval rules for plus user
  const plusUserId = users['plus@omniparse.test'].id;
  const approvalRules = [
    { name: 'Auto-approve small', minAmount: null, maxAmount: 1000, action: 'auto_approve' },
    { name: 'Review medium', minAmount: 1000, maxAmount: 5000, action: 'flag_for_review' },
    { name: 'Block large', minAmount: 5000, maxAmount: null, action: 'block' },
  ];
  for (const rule of approvalRules) {
    await db.approvalRule.create({ data: { userId: plusUserId, ...rule } });
  }
  console.log('  ✓ Created 3 approval rules for plus user');

  // Custom rules for plus user
  const customRules = [
    { name: 'High-value Acme', conditionJson: { type: 'and', conditions: [{ field: 'vendor', operator: 'equals', value: 'Acme Corp' }, { field: 'total', operator: 'greater_than', value: 5000 }] }, action: 'flag_as_warning' },
    { name: 'Missing vendor', conditionJson: { type: 'or', conditions: [{ field: 'vendor', operator: 'is_empty' }] }, action: 'flag_as_error' },
  ];
  for (const rule of customRules) {
    await db.customRule.create({ data: { userId: plusUserId, ...rule } });
  }
  console.log('  ✓ Created 2 custom rules for plus user');

  // Custom statuses for plus user
  const customStatuses = [
    { name: 'sent_to_accounting', color: '#8b5cf6', sortOrder: 4 },
    { name: 'waiting_approval', color: '#f97316', sortOrder: 5 },
  ];
  for (const s of customStatuses) {
    await db.customStatus.create({ data: { userId: plusUserId, ...s } });
  }
  console.log('  ✓ Created 2 custom statuses for plus user');

  // Export template for plus user
  await db.exportTemplate.create({
    data: {
      userId: plusUserId,
      name: 'GL Code Export',
      columns: [
        { key: 'vendor', label: 'Vendor Name', width: 30 },
        { key: 'invNumber', label: 'Invoice #', width: 20 },
        { key: 'invDate', label: 'Date', width: 14 },
        { key: 'total', label: 'Amount', width: 14 },
        { key: 'currency', label: 'Currency', width: 10 },
        { key: 'lifecycleStatus', label: 'Status', width: 14 },
      ],
      format: 'csv',
    },
  });
  console.log('  ✓ Created 1 export template for plus user');

  // Entities for business user
  const businessUserId = users['business@omniparse.test'].id;
  const entities = ['Acme Holding', 'TechVenture Subsidiary', 'CloudOps Division'];
  for (const name of entities) {
    await db.entity.create({ data: { userId: businessUserId, name } });
  }
  console.log('  ✓ Created 3 entities for business user');

  console.log('\n✅ Seeding complete!');
  console.log('Test accounts:');
  for (const u of TEST_USERS) {
    console.log(`  ${u.email} / Test1234 (${u.plan})`);
  }
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
