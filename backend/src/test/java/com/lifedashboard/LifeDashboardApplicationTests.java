package com.lifedashboard;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.ActiveProfiles;

@SpringBootTest
@ActiveProfiles("test")
@Import(TestFirebaseConfig.class)
class LifeDashboardApplicationTests {

    @Test
    void contextLoads() {
        // Verifies the Spring context wires up with the H2 test datasource
        // and a mocked FirebaseAuth.
    }
}
