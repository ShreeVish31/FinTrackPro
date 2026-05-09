/* APP STATE */
let transactions = JSON.parse(localStorage.getItem("transactions")) || [];
let accounts = JSON.parse(localStorage.getItem("accounts")) || [];
let debts = JSON.parse(localStorage.getItem("debts")) || [];

/* DOM ELEMENTS */
const balanceEl = document.getElementById("balance");
const incomeEl = document.getElementById("income");
const expenseEl = document.getElementById("expense");
const transactionList = document.getElementById("transactionList");
const accountsListEl = document.getElementById("accountsList");
const txAccountSelect = document.getElementById("txAccountSelect");
const monthlyReport = document.getElementById("monthlyReport");

/* CHARTS */
let expenseChart;
let incomeExpenseChart;

/* HAPTIC FEEDBACK (Native feel) */
function haptic() {
    if ("vibrate" in navigator) {
        navigator.vibrate(10); // Subtle 10ms pulse
    }
}

/* INITIALIZATION */
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById("todayDate").innerText = new Date().toLocaleDateString('en-IN', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });
    
    // Initial UI Render
    refreshAll();
});

/* NAVIGATION & TAB MANAGEMENT */
function showTab(tabName, el) {
    haptic();
    // Hide all sections
    const sections = ['homeSection', 'analyticsSection', 'reportsSection', 'transactionsSection', 'debtsSection'];
    sections.forEach(s => document.getElementById(s).classList.add('hidden'));
    
    // Update active nav item
    document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
    el.classList.add('active');

    // Show relevant section
    if (tabName === 'home') {
        document.getElementById('homeSection').classList.remove('hidden');
        document.getElementById('transactionsSection').classList.remove('hidden');
    } else if (tabName === 'analytics') {
        document.getElementById('analyticsSection').classList.remove('hidden');
    } else if (tabName === 'debts') {
        document.getElementById('debtsSection').classList.remove('hidden');
        renderDebts();
    } else if (tabName === 'reports') {
        document.getElementById('reportsSection').classList.remove('hidden');
    }
}

/* CSV STATEMENT EXPORT */
function exportToCSV() {
    haptic();
    if (transactions.length === 0) {
        alert("No transactions to export.");
        return;
    }

    const headers = ["Date", "Description", "Category", "Type", "Amount", "Account"];
    const rows = transactions.map(t => {
        const acc = accounts.find(a => a.id === t.accountId);
        return [
            new Date(t.time).toLocaleDateString(),
            `"${t.title.replace(/"/g, '""')}"`,
            t.category,
            t.type,
            t.amount,
            acc ? acc.name : "Unknown"
        ].join(",");
    });

    const csvContent = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `FinTrackPro_Statement_${new Date().toLocaleDateString()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    alert("Statement downloaded! You can open this in Excel or Google Sheets.");
}

/* PIN & BIOMETRIC PROTECTION */
let enteredPin = "";

document.addEventListener('DOMContentLoaded', () => {
    const pinTitle = document.querySelector("#pinScreen p");
    if (!localStorage.getItem("appPin")) {
        if (pinTitle) pinTitle.innerText = "Create a 4-Digit Security PIN";
    }
});

function appendPin(digit) {
    haptic();
    if (enteredPin.length < 4) {
        enteredPin += digit;
        updatePinDots();
        if (enteredPin.length === 4) {
            setTimeout(checkPin, 200);
        }
    }
}

function updatePinDots() {
    const dots = document.querySelectorAll('.dot');
    dots.forEach((dot, index) => {
        if (index < enteredPin.length) dot.classList.add('active');
        else dot.classList.remove('active');
    });
}

function backspacePin() {
    haptic();
    enteredPin = enteredPin.slice(0, -1);
    updatePinDots();
}

function resetPin() {
    haptic();
    enteredPin = "";
    updatePinDots();
}

function checkPin() {
    const storedPin = localStorage.getItem("appPin");
    
    // If no pin is set yet, the first 4 digits entered become the new PIN
    if (!storedPin) {
        if (confirm(`Set ${enteredPin} as your new security PIN?`)) {
            localStorage.setItem("appPin", enteredPin);
            alert("PIN set successfully! Keep it safe.");
            document.getElementById("pinScreen").classList.add("hidden");
            document.getElementById("mainApp").style.display = "block";
            refreshAll();
        } else {
            resetPin();
        }
        return;
    }

    if (enteredPin === storedPin) {
        document.getElementById("pinScreen").classList.add("hidden");
        document.getElementById("mainApp").style.display = "block";
        refreshAll();
    } else {
        alert("Incorrect PIN. Please try again.");
        resetPin();
    }
}

async function setupBiometrics() {
    haptic();
    if (localStorage.getItem("biometricSetup") === "true") {
        if (confirm("Disable biometric login?")) {
            localStorage.removeItem("biometricSetup");
            location.reload();
        }
        return;
    }

    if (!window.PublicKeyCredential) {
        alert("Your device doesn't support biometric login.");
        return;
    }

    try {
        const challenge = new Uint8Array(32);
        window.crypto.getRandomValues(challenge);
        
        const createCredentialOptions = {
            publicKey: {
                challenge,
                rp: { 
                    name: "FinTrackPro",
                    id: window.location.hostname 
                },
                user: {
                    id: new Uint8Array(16),
                    name: "user@fintrackpro",
                    displayName: "FinTrackPro User"
                },
                pubKeyCredParams: [{ alg: -7, type: "public-key" }],
                authenticatorSelection: { userVerification: "required" },
                timeout: 60000
            }
        };

        const credential = await navigator.credentials.create(createCredentialOptions);
        if (credential) {
            localStorage.setItem("biometricSetup", "true");
            alert("Biometric login enabled successfully!");
            location.reload();
        }
    } catch (err) {
        if (window.location.hostname === "127.0.0.1") {
            alert("Setup failed: Biometrics require using 'localhost' instead of '127.0.0.1' in the address bar. Please switch to http://localhost:5500");
        } else {
            alert("Setup failed: " + err.message);
        }
    }
}

async function authenticateBiometrics() {
    haptic();
    try {
        const challenge = new Uint8Array(32);
        window.crypto.getRandomValues(challenge);

        const getCredentialOptions = {
            publicKey: {
                challenge,
                rpId: window.location.hostname, // Explicitly match the domain
                timeout: 60000,
                userVerification: "required"
            }
        };

        const assertion = await navigator.credentials.get(getCredentialOptions);
        if (assertion) {
            document.getElementById("pinScreen").classList.add("hidden");
            document.getElementById("mainApp").style.display = "block";
            refreshAll();
        }
    } catch (err) {
        console.log("Biometric failed", err);
        // If it fails with a specific error, we show a hint
        if (err.name === "NotAllowedError") {
            console.log("User canceled or no passkey found.");
        }
    }
}

function resetAppPin() {
    haptic();
    if (confirm("Are you sure you want to change your PIN? You will be logged out and asked to set a new one.")) {
        localStorage.removeItem("appPin");
        localStorage.removeItem("biometricSetup");
        location.reload();
    }
}

// Function to sync biometric UI
function syncBiometricUI() {
    const isSetup = localStorage.getItem("biometricSetup") === "true";
    const bioBtn = document.getElementById("biometricBtn");
    const setupBtn = document.getElementById("setupBioBtn");

    if (isSetup && bioBtn) {
        bioBtn.classList.remove("hidden");
    }

    if (setupBtn) {
        if (isSetup) {
            setupBtn.innerText = "Disable";
            setupBtn.style.background = "var(--expense)";
        } else {
            setupBtn.innerText = "Enable";
            setupBtn.style.background = "var(--primary)";
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    syncBiometricUI();
    
    if (localStorage.getItem("biometricSetup") === "true") {
        // Auto-trigger biometric prompt after a short delay for mobile stability
        setTimeout(authenticateBiometrics, 600);
    }
});

// Also check when the window gets focus (returning to app)
window.addEventListener('focus', syncBiometricUI);

/* THEME MANAGEMENT */
function toggleTheme() {
    document.body.classList.toggle("light-mode");
    const btn = document.getElementById("themeToggle");
    btn.innerText = document.body.classList.contains("light-mode") ? "☀️" : "🌙";
}

/* ACCOUNT MANAGEMENT (CRUD) */
function openAccountModal(id = null) {
    const modal = document.getElementById("accountModal");
    const title = document.getElementById("accModalTitle");
    const saveBtn = document.getElementById("accSaveBtn");
    const deleteBtn = document.getElementById("accDeleteBtn");
    
    if (id) {
        const acc = accounts.find(a => a.id === id);
        document.getElementById("editAccountId").value = id;
        document.getElementById("accName").value = acc.name;
        document.getElementById("accBalance").value = acc.balance;
        title.innerText = "Edit Account";
        saveBtn.innerText = "Update Account";
        deleteBtn.classList.remove("hidden");
    } else {
        document.getElementById("editAccountId").value = "";
        document.getElementById("accName").value = "";
        document.getElementById("accBalance").value = "";
        title.innerText = "Add New Account";
        saveBtn.innerText = "Create Account";
        deleteBtn.classList.add("hidden");
    }
    modal.style.display = "flex";
}

/* DATA BACKUP & RESTORE */
/* DEBT TRACKER LOGIC */
function openDebtModal() {
    haptic();
    document.getElementById("debtModal").style.display = "flex";
}

function saveDebt() {
    haptic();
    const person = document.getElementById("debtPerson").value;
    const amount = parseFloat(document.getElementById("debtAmount").value);
    const type = document.getElementById("debtType").value;

    if (!person || isNaN(amount)) {
        alert("Please provide valid details.");
        return;
    }

    const debt = {
        id: Date.now(),
        person,
        amount,
        type,
        time: new Date().toISOString()
    };

    debts.push(debt);
    saveData();
    renderDebts();
    closeModal('debtModal');
    
    // Clear inputs
    document.getElementById("debtPerson").value = "";
    document.getElementById("debtAmount").value = "";
}

function deleteDebt(id) {
    haptic();
    debts = debts.filter(d => d.id !== id);
    saveData();
    renderDebts();
}

function renderDebts() {
    const list = document.getElementById("debtList");
    if (!list) return;

    list.innerHTML = "";
    let lent = 0;
    let borrowed = 0;

    debts.forEach(d => {
        if (d.type === 'lent') lent += d.amount;
        else borrowed += d.amount;

        const li = document.createElement("li");
        li.className = "transaction-item";
        li.innerHTML = `
            <div class="transaction-info">
                <strong>${d.person}</strong>
                <div class="transaction-meta">
                    <span class="${d.type === 'lent' ? 'income' : 'expense'}" style="font-weight: 700;">
                        ${d.type === 'lent' ? 'Lent' : 'Borrowed'}
                    </span>
                </div>
            </div>
            <div class="transaction-amount">
                <span class="amount-val ${d.type === 'lent' ? 'income' : 'expense'}">
                    ₹${d.amount.toLocaleString('en-IN')}
                </span>
                <div class="tx-actions">
                    <button class="action-btn delete" onclick="deleteDebt(${d.id})">🗑️</button>
                </div>
            </div>
        `;
        list.appendChild(li);
    });

    document.getElementById("lentTotal").innerText = `₹${lent.toLocaleString('en-IN')}`;
    document.getElementById("borrowedTotal").innerText = `₹${borrowed.toLocaleString('en-IN')}`;
    const net = lent - borrowed;
    const netEl = document.getElementById("netDebt");
    netEl.innerText = net.toLocaleString('en-IN');
    netEl.className = net >= 0 ? "income" : "expense";
}

async function exportData() {
    haptic();
    localStorage.setItem('lastExportDate', new Date().toDateString());
    const reminder = document.getElementById("backupReminder");
    if (reminder) reminder.classList.add("hidden");

    const data = {
        accounts: accounts,
        transactions: transactions,
        debts: debts,
        version: '1.2',
        exportDate: new Date().toISOString()
    };
    
    const jsonData = JSON.stringify(data, null, 2);
    const fileName = `FinTrackPro_Backup.json`;

    // PRO OVERWRITE: For Desktop users (Chrome/Edge/Windows)
    if ('showSaveFilePicker' in window) {
        try {
            const handle = await window.showSaveFilePicker({
                suggestedName: fileName,
                types: [{
                    description: 'JSON File',
                    accept: { 'application/json': ['.json'] },
                }],
            });
            const writable = await handle.createWritable();
            await writable.write(jsonData);
            await writable.close();
            alert("Backup successfully updated!");
            return;
        } catch (err) {
            if (err.name === 'AbortError') return; // User cancelled
            console.error("File Picker failed, falling back to download", err);
        }
    }

    // FALLBACK: For Mobile / Un-supported browsers
    const blob = new Blob([jsonData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    alert(`Backup saved in 'Downloads' folder.`);
}


function checkBackupReminder() {
    const lastExport = localStorage.getItem('lastExportDate');
    const today = new Date().toDateString();
    
    if (lastExport !== today && accounts.length > 0) {
        const reminder = document.getElementById("backupReminder");
        if (reminder) reminder.classList.remove("hidden");
    }
}

function importData(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = JSON.parse(e.target.result);
            if (data.accounts && data.transactions) {
                if (confirm("This will replace all your current data with the backup. Are you sure?")) {
                    accounts = data.accounts;
                    transactions = data.transactions;
                    debts = data.debts || [];
                    saveData();
                    refreshAll();
                    haptic();
                    alert("Data restored successfully!");
                }
            } else {
                alert("Invalid backup file format.");
            }
        } catch (err) {
            alert("Error reading file: " + err.message);
        }
    };
    reader.readAsText(file);
}

function saveAccount() {
    haptic();
    const id = document.getElementById("editAccountId").value;
    const name = document.getElementById("accName").value;
    const balance = parseFloat(document.getElementById("accBalance").value);

    if (!name || isNaN(balance)) {
        alert("Please provide valid account details.");
        return;
    }

    if (id) {
        // Edit existing
        const index = accounts.findIndex(a => a.id == id);
        accounts[index] = { ...accounts[index], name, balance };
    } else {
        // Create new
        accounts.push({ id: Date.now(), name, balance });
    }

    saveData();
    refreshAll();
    closeModal('accountModal');
    
    // Close onboarding if it was open
    document.getElementById("onboardingScreen").classList.add("hidden");
}

function deleteAccount() {
    const id = document.getElementById("editAccountId").value;
    if (confirm("Are you sure? This will also remove all transactions linked to this account.")) {
        accounts = accounts.filter(a => a.id != id);
        transactions = transactions.filter(t => t.accountId != id);
        saveData();
        refreshAll();
        closeModal('accountModal');
    }
}

/* TRANSACTION MANAGEMENT */
function openTxModal(id = null) {
    if (accounts.length === 0) {
        alert("Please add at least one account first.");
        return;
    }
    
    const modal = document.getElementById("transactionModal");
    const title = document.getElementById("modalTitle");
    const editIdInput = document.getElementById("editTxId");
    const dateTimeInput = document.getElementById("txDateTime");
    
    populateAccountSelect();

    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    const localNow = now.toISOString().slice(0, 16);
    dateTimeInput.max = localNow;

    if (id) {
        const tx = transactions.find(t => t.id === id);
        title.innerText = "Edit Transaction";
        editIdInput.value = id;
        document.getElementById("txTitle").value = tx.title;
        document.getElementById("txAmount").value = tx.amount;
        document.getElementById("txType").value = tx.type;
        
        // Format ISO for datetime-local input (YYYY-MM-DDThh:mm)
        dateTimeInput.value = new Date(tx.time).toISOString().slice(0, 16);
        
        // Handle categories
        const categorySelect = document.getElementById("txCategory");
        const options = Array.from(categorySelect.options).map(o => o.value);
        if (options.includes(tx.category)) {
            categorySelect.value = tx.category;
            document.getElementById("customCategory").classList.add("hidden");
        } else {
            categorySelect.value = "Others";
            document.getElementById("customCategory").value = tx.category;
            document.getElementById("customCategory").classList.remove("hidden");
        }
        
        document.getElementById("txAccountSelect").value = tx.accountId;
    } else {
        title.innerText = "Add Transaction";
        editIdInput.value = "";
        document.getElementById("txTitle").value = "";
        document.getElementById("txAmount").value = "";
        document.getElementById("customCategory").value = "";
        document.getElementById("customCategory").classList.add("hidden");
        dateTimeInput.value = localNow;
    }

    modal.style.display = "flex";
}

function toggleCustomCategory() {
    const category = document.getElementById("txCategory").value;
    const customInput = document.getElementById("customCategory");
    if (category === "Others") {
        customInput.classList.remove("hidden");
    } else {
        customInput.classList.add("hidden");
    }
}

function handleTxTypeChange() {
    const type = document.getElementById("txType").value;
    const transferContainer = document.getElementById("transferTargetContainer");
    const categoryGroup = document.getElementById("txCategory");
    
    if (type === "transfer") {
        transferContainer.classList.remove("hidden");
        document.getElementById("accSelectLabel").innerText = "Transfer From Account";
        categoryGroup.value = "Transfer";
        categoryGroup.disabled = true;
    } else {
        transferContainer.classList.add("hidden");
        document.getElementById("accSelectLabel").innerText = "Account";
        categoryGroup.disabled = false;
    }
}

function saveTransaction() {
    haptic();
    const editId = document.getElementById("editTxId").value;
    const title = document.getElementById("txTitle").value;
    const amount = parseFloat(document.getElementById("txAmount").value);
    const type = document.getElementById("txType").value;
    const dateTime = document.getElementById("txDateTime").value;
    let category = document.getElementById("txCategory").value;
    const accountId = parseInt(document.getElementById("txAccountSelect").value);
    const toAccountId = parseInt(document.getElementById("txToAccountSelect")?.value);

    if (category === "Others") {
        category = document.getElementById("customCategory").value || "Others";
    }

    if (!title || isNaN(amount) || isNaN(accountId) || !dateTime) {
        alert("Please fill all required fields correctly.");
        return;
    }

    if (type === "transfer" && (isNaN(toAccountId) || accountId === toAccountId)) {
        alert("Please select a different target account for transfer.");
        return;
    }

    const transactionTime = new Date(dateTime).toISOString();

    if (new Date(transactionTime) > new Date()) {
        alert("You cannot record a transaction for a future date!");
        return;
    }

    if (editId) {
        // EDIT MODE (Simplified for this update: Reverting any previous transaction and adding new)
        const txIndex = transactions.findIndex(t => t.id == editId);
        const oldTx = transactions[txIndex];

        // 1. Reverse old impact
        const oldFromAcc = accounts.find(a => a.id === oldTx.accountId);
        if (oldFromAcc) {
            if (oldTx.type === "income") oldFromAcc.balance -= oldTx.amount;
            else if (oldTx.type === "expense") oldFromAcc.balance += oldTx.amount;
            else if (oldTx.type === "transfer") {
                oldFromAcc.balance += oldTx.amount;
                const oldToAcc = accounts.find(a => a.id === oldTx.toAccountId);
                if (oldToAcc) oldToAcc.balance -= oldTx.amount;
            }
        }

        // 2. Update transaction
        transactions[txIndex] = {
            ...oldTx,
            title, amount, type, category, accountId,
            toAccountId: type === "transfer" ? toAccountId : null,
            time: transactionTime
        };

        // 3. Apply new impact
        const newFromAcc = accounts.find(a => a.id === accountId);
        if (newFromAcc) {
            if (type === "income") newFromAcc.balance += amount;
            else if (type === "expense") newFromAcc.balance -= amount;
            else if (type === "transfer") {
                newFromAcc.balance -= amount;
                const newToAcc = accounts.find(a => a.id === toAccountId);
                if (newToAcc) newToAcc.balance += amount;
            }
        }
    } else {
        // ADD MODE
        const transaction = {
            id: Date.now(),
            title, amount, type, category, accountId,
            toAccountId: type === "transfer" ? toAccountId : null,
            time: transactionTime
        };
        transactions.push(transaction);

        const fromAcc = accounts.find(a => a.id === accountId);
        if (type === "income") fromAcc.balance += amount;
        else if (type === "expense") fromAcc.balance -= amount;
        else if (type === "transfer") {
            fromAcc.balance -= amount;
            const toAcc = accounts.find(a => a.id === toAccountId);
            if (toAcc) toAcc.balance += amount;
        }
    }

    saveData();
    refreshAll();
    closeModal('transactionModal');
}

function deleteTransaction(id) {
    if (!confirm("Are you sure you want to delete this transaction?")) return;
    
    const tx = transactions.find(t => t.id === id);
    if (!tx) return;

    const fromAcc = accounts.find(a => a.id === tx.accountId);
    if (fromAcc) {
        if (tx.type === "income") fromAcc.balance -= tx.amount;
        else if (tx.type === "expense") fromAcc.balance += tx.amount;
        else if (tx.type === "transfer") {
            fromAcc.balance += tx.amount;
            const toAcc = accounts.find(a => a.id === tx.toAccountId);
            if (toAcc) toAcc.balance -= tx.amount;
        }
    }

    transactions = transactions.filter(t => t.id !== id);
    saveData();
    refreshAll();
}

function populateAccountSelect() {
    const selects = ["txAccountSelect", "txToAccountSelect"];
    selects.forEach(sId => {
        const el = document.getElementById(sId);
        if (!el) return;
        el.innerHTML = accounts.map(acc => `<option value="${acc.id}">${acc.name} (₹${acc.balance})</option>`).join("");
    });
}

/* UI RENDERING LOGIC */
function refreshAll() {
    const onboarding = document.getElementById("onboardingScreen");
    const mainApp = document.getElementById("mainApp");
    
    if (accounts.length === 0) {
        onboarding.classList.remove("hidden");
    } else {
        onboarding.classList.add("hidden");
    }

    renderAccounts();
    renderTransactions();
    calculateTotals();
    renderCharts();
    generateReport();
    checkBackupReminder();
}

function renderAccounts() {
    accountsListEl.innerHTML = "";
    txAccountSelect.innerHTML = "";

    if (accounts.length === 0) {
        accountsListEl.innerHTML = "<p style='padding: 20px; color: #64748b;'>No accounts found. Add one to get started.</p>";
        return;
    }

    accounts.forEach(acc => {
        // Render Account Card
        const card = document.createElement("div");
        card.className = "account-card";
        card.onclick = () => openAccountModal(acc.id);
        card.innerHTML = `
            <div class="account-edit-btn">✎</div>
            <h3>${acc.name}</h3>
            <p>₹${acc.balance.toLocaleString('en-IN')}</p>
        `;
        accountsListEl.appendChild(card);

        // Populate Transaction Modal Select
        const option = document.createElement("option");
        option.value = acc.id;
        option.innerText = acc.name;
        txAccountSelect.appendChild(option);
    });
}

function renderTransactions() {
    transactionList.innerHTML = "";
    
    // Filters
    const start = document.getElementById("startDate").value;
    const end = document.getElementById("endDate").value;
    const query = document.getElementById("searchInput").value.toLowerCase();

    let filtered = transactions.filter(t => {
        const tDate = t.time.split('T')[0];
        const inRange = (!start || tDate >= start) && (!end || tDate <= end);
        const matchesQuery = t.title.toLowerCase().includes(query) || t.category.toLowerCase().includes(query);
        return inRange && matchesQuery;
    });

    // Sort descending
    filtered.sort((a, b) => new Date(b.time) - new Date(a.time));

    if (filtered.length === 0) {
        transactionList.innerHTML = "<p style='padding: 20px; text-align: center; color: #64748b;'>No matching transactions.</p>";
        return;
    }

    // Group by Date
    const groups = {};
    filtered.forEach(t => {
        const dateKey = new Date(t.time).toDateString();
        if (!groups[dateKey]) groups[dateKey] = [];
        groups[dateKey].push(t);
    });

    // Render Groups
    Object.keys(groups).forEach(date => {
        const header = document.createElement("div");
        header.className = "date-header";
        
        const today = new Date().toDateString();
        const yesterday = new Date(Date.now() - 86400000).toDateString();
        
        const dayTransactions = groups[date];
        const dayInc = dayTransactions.filter(t => t.type === "income").reduce((s, t) => s + t.amount, 0);
        const dayExp = dayTransactions.filter(t => t.type === "expense").reduce((s, t) => s + t.amount, 0);
        const dayNet = dayInc - dayExp;

        let dateTitle = date;
        if (date === today) dateTitle = "Today";
        else if (date === yesterday) dateTitle = "Yesterday";
        
        header.innerHTML = `
            <span>${dateTitle}</span>
            <div class="day-summary">
                <span class="day-net ${dayNet >= 0 ? 'income' : 'expense'}">${dayNet >= 0 ? '+' : ''}₹${dayNet.toLocaleString('en-IN')}</span>
                <div class="day-breakdown">
                    ${dayInc > 0 ? `<span class="day-inc">↑₹${dayInc.toLocaleString('en-IN')}</span>` : ''}
                    ${dayExp > 0 ? `<span class="day-exp">↓₹${dayExp.toLocaleString('en-IN')}</span>` : ''}
                </div>
            </div>
        `;
        
        transactionList.appendChild(header);

        const page = document.createElement("div");
        page.className = "notebook-page";

        dayTransactions.forEach(t => {
            const acc = accounts.find(a => a.id === t.accountId);
            const row = document.createElement("div");
            row.className = `transaction-item ${t.type}-row`;
            row.innerHTML = `
                <div class="transaction-info">
                    <strong>${t.title}</strong>
                    <div class="transaction-meta">
                        <span>${t.category}</span> • 
                        <span>${acc ? acc.name : 'Unknown'}</span>
                    </div>
                </div>
                <div class="transaction-amount">
                    <span class="amount-val ${t.type}">
                        ${t.type === 'income' ? '+' : '-'} ₹${t.amount.toLocaleString('en-IN')}
                    </span>
                    <div class="tx-actions">
                        <button class="action-btn edit" onclick="openTxModal(${t.id})">✏️</button>
                        <button class="action-btn delete" onclick="deleteTransaction(${t.id})">🗑️</button>
                    </div>
                </div>
            `;
            page.appendChild(row);
        });
        transactionList.appendChild(page);
    });
}

function clearFilters() {
    document.getElementById("startDate").value = "";
    document.getElementById("endDate").value = "";
    document.getElementById("searchInput").value = "";
    refreshAll();
}

function calculateTotals() {
    // Total Net Worth = Sum of all account balances
    const totalBalance = accounts.reduce((sum, acc) => sum + acc.balance, 0);
    balanceEl.innerText = `₹${totalBalance.toLocaleString('en-IN')}`;

    // Monthly Income/Expense Calculation
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    let monthlyInc = 0;
    let monthlyExp = 0;

    transactions.forEach(t => {
        const date = new Date(t.time);
        if (date.getMonth() === currentMonth && date.getFullYear() === currentYear) {
            if (t.type === 'income') monthlyInc += t.amount;
            else monthlyExp += t.amount;
        }
    });

    incomeEl.innerText = `₹${monthlyInc.toLocaleString('en-IN')}`;
    expenseEl.innerText = `₹${monthlyExp.toLocaleString('en-IN')}`;
}

function searchTransactions() {
    // Re-use rendering for search as well for proper grouping
    renderTransactions();
}

/* DATA STORAGE */
function saveData() {
    localStorage.setItem("transactions", JSON.stringify(transactions));
    localStorage.setItem("accounts", JSON.stringify(accounts));
    localStorage.setItem("debts", JSON.stringify(debts));
}

/* MODAL UTILS */
function closeModal(id) {
    document.getElementById(id).style.display = "none";
}

function populateAccountSelect() {
    txAccountSelect.innerHTML = "";
    accounts.forEach(acc => {
        const opt = document.createElement("option");
        opt.value = acc.id;
        opt.innerText = acc.name;
        txAccountSelect.appendChild(opt);
    });
}

/* CHARTS & ANALYTICS */
function renderCharts() {
    const categoryTotals = {};
    let totalInc = 0;
    let totalExp = 0;

    transactions.forEach(t => {
        if (t.type === 'expense') {
            categoryTotals[t.category] = (categoryTotals[t.category] || 0) + t.amount;
            totalExp += t.amount;
        } else {
            totalInc += t.amount;
        }
    });

    // Expense Doughnut
    const ctx1 = document.getElementById("expenseChart");
    if (expenseChart) expenseChart.destroy();
    
    expenseChart = new Chart(ctx1, {
        type: 'doughnut',
        data: {
            labels: Object.keys(categoryTotals),
            datasets: [{
                data: Object.values(categoryTotals),
                backgroundColor: [
                    '#6366f1', '#ec4899', '#f59e0b', '#10b981', '#ef4444', 
                    '#8b5cf6', '#06b6d4', '#f97316'
                ],
                borderWidth: 0
            }]
        },
        options: {
            plugins: {
                legend: { position: 'bottom', labels: { color: '#94a3b8', font: { size: 10 } } },
                title: { display: true, text: 'Expenses by Category', color: '#94a3b8' }
            }
        }
    });

    // Income vs Expense Bar
    const ctx2 = document.getElementById("incomeExpenseChart");
    if (incomeExpenseChart) incomeExpenseChart.destroy();

    incomeExpenseChart = new Chart(ctx2, {
        type: 'bar',
        data: {
            labels: ['Income', 'Expense'],
            datasets: [{
                data: [totalInc, totalExp],
                backgroundColor: ['#22c55e', '#ef4444'],
                borderRadius: 8
            }]
        },
        options: {
            plugins: {
                legend: { display: false },
                title: { display: true, text: 'Overall Cash Flow', color: '#94a3b8' }
            },
            scales: {
                y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#64748b' } },
                x: { grid: { display: false }, ticks: { color: '#64748b' } }
            }
        }
    });
}

function generateReport() {
    const expenses = transactions.filter(t => t.type === 'expense');
    const totalInc = transactions.filter(t => t.type === 'income').reduce((s,t) => s+t.amount, 0);
    const totalExp = expenses.reduce((s,t) => s+t.amount, 0);
    const savings = totalInc - totalExp;
    const savingsRate = totalInc > 0 ? ((savings/totalInc)*100).toFixed(1) : 0;

    // 1. Summary Report
    monthlyReport.innerHTML = `
        <div style="line-height: 2;">
            Total Earnings: <strong>₹${totalInc.toLocaleString('en-IN')}</strong><br>
            Total Spending: <strong>₹${totalExp.toLocaleString('en-IN')}</strong><br>
            Overall Savings: <strong style="color: ${savings >= 0 ? 'var(--income)' : 'var(--expense)'}">₹${savings.toLocaleString('en-IN')}</strong><br>
            Savings Rate: <strong>${savingsRate}%</strong><br><br>
            <em>${savingsRate > 20 ? "You're doing great! Keep saving." : "Try to reduce non-essential expenses."}</em>
        </div>
    `;

    // 2. Top Expense Spotlight
    if (expenses.length > 0) {
        const top = expenses.reduce((prev, current) => (prev.amount > current.amount) ? prev : current);
        const amountEl = document.getElementById("topExpenseAmount");
        const categoryEl = document.getElementById("topExpenseCategory");
        if (amountEl) amountEl.innerText = `₹${top.amount.toLocaleString('en-IN')}`;
        if (categoryEl) categoryEl.innerText = top.category;
    }

    // 3. Smart Insights & Velocity
    const insightsContainer = document.getElementById("smartInsights");
    if (insightsContainer) insightsContainer.innerHTML = "";
    
    const now = new Date();
    const daysPassed = now.getDate();
    const dailyAvg = (totalExp / daysPassed).toFixed(0);
    
    const velocityEl = document.getElementById("spendingVelocity");
    if (velocityEl) velocityEl.innerText = `₹${parseInt(dailyAvg).toLocaleString('en-IN')}`;
    
    const insights = [];

    // Velocity Insight
    insights.push({
        icon: "⚡",
        title: "Spending Velocity",
        desc: `You are spending an average of <strong>₹${dailyAvg}</strong> per day this month.`
    });

    // Category Insight
    if (expenses.length > 0) {
        const catMap = {};
        expenses.forEach(e => catMap[e.category] = (catMap[e.category] || 0) + e.amount);
        const topCat = Object.keys(catMap).reduce((a, b) => catMap[a] > catMap[b] ? a : b);
        insights.push({
            icon: "🏷️",
            title: "Highest Category",
            desc: `Most of your money is going to <strong>${topCat}</strong> (₹${catMap[topCat].toLocaleString('en-IN')}).`
        });
    }

    // Savings Insight
    if (savingsRate < 10 && totalInc > 0) {
        insights.push({
            icon: "⚠️",
            title: "Low Savings",
            desc: "Your savings rate is below 10%. Consider reviewing your shopping or entertainment expenses."
        });
    } else if (savingsRate > 50) {
        insights.push({
            icon: "🏆",
            title: "Financial Rockstar",
            desc: "You saved more than half of your income! You're on the fast track to financial freedom."
        });
    }

    insights.forEach(ins => {
        const div = document.createElement("div");
        div.className = "insight-chip";
        div.innerHTML = `
            <div class="icon">${ins.icon}</div>
            <div class="content">
                <div style="font-weight: 700; margin-bottom: 4px;">${ins.title}</div>
                <div style="font-size: 0.85rem; color: #94a3b8;">${ins.desc}</div>
            </div>
        `;
        insightsContainer.appendChild(div);
    });
}