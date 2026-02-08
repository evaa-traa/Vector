/**
 * Labs Persistence Test Suite
 * Run this in browser console at http://localhost:5173/
 * 
 * Tests the localStorage persistence logic for Labs projects
 */

const STORAGE_KEY = "labs_projects_global";

console.log("=== LABS PERSISTENCE TEST SUITE ===\n");

// Test 1: Storage Key Existence
function test1_storageExists() {
    console.log("TEST 1: Check if storage key exists");
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
        console.log("✅ Storage key exists");
        console.log(`   Size: ${raw.length} bytes`);
        return true;
    } else {
        console.log("⚠️  Storage key does not exist (fresh start)");
        return false;
    }
}

// Test 2: Parse Storage Data
function test2_parseData() {
    console.log("\nTEST 2: Parse stored data");
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
        console.log("⚠️  No data to parse");
        return null;
    }
    try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
            console.log(`✅ Data parsed successfully - ${parsed.length} projects`);
            return parsed;
        } else {
            console.log("❌ Data is not an array");
            return null;
        }
    } catch (e) {
        console.log("❌ JSON parse failed:", e.message);
        return null;
    }
}

// Test 3: Validate Project Structure
function test3_validateProjects(projects) {
    console.log("\nTEST 3: Validate project structure");
    if (!projects || projects.length === 0) {
        console.log("⚠️  No projects to validate");
        return false;
    }

    let allValid = true;
    const requiredFields = ["id", "sessionId", "name", "createdAt", "updatedAt", "document"];

    projects.forEach((project, index) => {
        const missing = requiredFields.filter(field => !(field in project));
        if (missing.length > 0) {
            console.log(`❌ Project ${index} missing fields: ${missing.join(", ")}`);
            allValid = false;
        } else {
            console.log(`✅ Project ${index}: "${project.name}" - valid structure`);
            console.log(`   ID: ${project.id}`);
            console.log(`   SessionID: ${project.sessionId}`);
            console.log(`   Document length: ${(project.document || "").length} chars`);
        }
    });

    return allValid;
}

// Test 4: Unique Session IDs
function test4_uniqueSessionIds(projects) {
    console.log("\nTEST 4: Check unique sessionIds");
    if (!projects || projects.length === 0) {
        console.log("⚠️  No projects to check");
        return true;
    }

    const sessionIds = projects.map(p => p.sessionId);
    const uniqueIds = new Set(sessionIds);

    if (sessionIds.length === uniqueIds.size) {
        console.log(`✅ All ${sessionIds.length} sessionIds are unique`);
        return true;
    } else {
        console.log(`❌ Duplicate sessionIds found!`);
        return false;
    }
}

// Test 5: Save and Load Cycle
function test5_saveLoadCycle() {
    console.log("\nTEST 5: Save and Load Cycle");

    // Create test project
    const testProject = {
        id: "test-" + Date.now(),
        sessionId: "session-" + Date.now(),
        modelId: "test-model",
        name: "Test Project " + new Date().toLocaleTimeString(),
        createdAt: Date.now(),
        updatedAt: Date.now(),
        document: "Test document content for persistence testing."
    };

    // Get current projects
    const raw = localStorage.getItem(STORAGE_KEY);
    let projects = [];
    try {
        projects = raw ? JSON.parse(raw) : [];
    } catch (e) {
        projects = [];
    }

    // Add test project
    projects.push(testProject);

    // Save
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
        console.log("✅ Save successful");
    } catch (e) {
        console.log("❌ Save failed:", e.message);
        return false;
    }

    // Load and verify
    try {
        const loaded = JSON.parse(localStorage.getItem(STORAGE_KEY));
        const found = loaded.find(p => p.id === testProject.id);
        if (found && found.document === testProject.document) {
            console.log("✅ Load and verify successful");
            console.log(`   Project "${testProject.name}" persisted correctly`);

            // Clean up - remove test project
            const cleaned = loaded.filter(p => p.id !== testProject.id);
            localStorage.setItem(STORAGE_KEY, JSON.stringify(cleaned));
            console.log("✅ Test project cleaned up");
            return true;
        } else {
            console.log("❌ Loaded data doesn't match saved data");
            return false;
        }
    } catch (e) {
        console.log("❌ Load failed:", e.message);
        return false;
    }
}

// Test 6: Large Document Handling
function test6_largeDocument() {
    console.log("\nTEST 6: Large document handling");

    // Create a large document (100KB)
    const largeDoc = "x".repeat(100000);
    const testProject = {
        id: "large-test-" + Date.now(),
        sessionId: "session-" + Date.now(),
        modelId: "",
        name: "Large Doc Test",
        createdAt: Date.now(),
        updatedAt: Date.now(),
        document: largeDoc
    };

    try {
        localStorage.setItem("test_large", JSON.stringify([testProject]));
        const loaded = JSON.parse(localStorage.getItem("test_large"));
        localStorage.removeItem("test_large");

        if (loaded[0].document.length === 100000) {
            console.log("✅ Large document (100KB) saved and loaded correctly");
            return true;
        } else {
            console.log("❌ Large document corrupted");
            return false;
        }
    } catch (e) {
        console.log("❌ Large document test failed:", e.message);
        localStorage.removeItem("test_large");
        return false;
    }
}

// Run all tests
function runAllTests() {
    console.log("\n" + "=".repeat(50));
    console.log("RUNNING ALL TESTS");
    console.log("=".repeat(50) + "\n");

    const results = [];

    results.push({ name: "Storage Exists", passed: test1_storageExists() });

    const projects = test2_parseData();
    results.push({ name: "Parse Data", passed: projects !== null || localStorage.getItem(STORAGE_KEY) === null });

    if (projects) {
        results.push({ name: "Validate Projects", passed: test3_validateProjects(projects) });
        results.push({ name: "Unique SessionIds", passed: test4_uniqueSessionIds(projects) });
    }

    results.push({ name: "Save/Load Cycle", passed: test5_saveLoadCycle() });
    results.push({ name: "Large Document", passed: test6_largeDocument() });

    console.log("\n" + "=".repeat(50));
    console.log("TEST RESULTS SUMMARY");
    console.log("=".repeat(50));

    const passed = results.filter(r => r.passed).length;
    const total = results.length;

    results.forEach(r => {
        console.log(`${r.passed ? "✅" : "❌"} ${r.name}`);
    });

    console.log("\n" + `${passed}/${total} tests passed`);

    if (passed === total) {
        console.log("\n🎉 ALL TESTS PASSED! Persistence is working correctly.");
    } else {
        console.log("\n⚠️  Some tests failed. Check the output above.");
    }

    return { passed, total, results };
}

// Export for browser console
window.labsTest = { runAllTests, test1_storageExists, test2_parseData, test3_validateProjects, test4_uniqueSessionIds, test5_saveLoadCycle, test6_largeDocument };

console.log("\nTest suite loaded. Run: labsTest.runAllTests()");
console.log("Or run individual tests: labsTest.test1_storageExists()");

// Auto-run
runAllTests();
