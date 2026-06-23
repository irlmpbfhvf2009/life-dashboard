# ---- Build stage ----
# Uses the official Maven + Temurin 21 image so no Maven wrapper jar is required.
FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /app

# Cache dependencies first for faster rebuilds.
COPY pom.xml ./
RUN mvn -B dependency:go-offline

# Build the application (tests run in CI, skipped here for fast image builds).
COPY src/ src/
RUN mvn -B clean package -DskipTests

# ---- Runtime stage ----
FROM eclipse-temurin:21-jre AS runtime
WORKDIR /app

# Run as a non-root user.
RUN groupadd --system app && useradd --system --gid app app

COPY --from=build /app/target/*.jar app.jar
USER app

# Cloud Run provides $PORT (default 8080). Keep the JVM heap modest for 512Mi.
ENV JAVA_OPTS="-XX:MaxRAMPercentage=75.0"
EXPOSE 8080

ENTRYPOINT ["sh", "-c", "java $JAVA_OPTS -jar app.jar"]
