package com.lifedashboard.ai;

import com.lifedashboard.ai.dto.AiKeyRequest;
import com.lifedashboard.ai.dto.AiKeyStatus;
import com.lifedashboard.ai.dto.ChatReply;
import com.lifedashboard.ai.dto.ChatRequest;
import com.lifedashboard.ai.dto.CorrectionReply;
import com.lifedashboard.ai.dto.DataInsightReply;
import com.lifedashboard.ai.dto.DataInsightRequest;
import com.lifedashboard.ai.dto.FoodReply;
import com.lifedashboard.ai.dto.FoodRequest;
import com.lifedashboard.ai.dto.NutritionEntryReply;
import com.lifedashboard.ai.dto.NutritionRequest;
import com.lifedashboard.ai.dto.NutritionReviewReply;
import com.lifedashboard.ai.dto.NutritionReviewRequest;
import com.lifedashboard.ai.dto.PhraseReply;
import com.lifedashboard.ai.dto.PhraseTranslateRequest;
import com.lifedashboard.ai.dto.ReceiptReply;
import com.lifedashboard.ai.dto.ReceiptRequest;
import com.lifedashboard.ai.dto.SpotReply;
import com.lifedashboard.ai.dto.SpotRequest;
import com.lifedashboard.common.ApiResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/ai")
@RequiredArgsConstructor
public class AiController {

    private final EnglishCoachService englishCoach;
    private final PhraseCoachService phraseCoach;
    private final ReceiptService receiptService;
    private final SpotSuggestService spotSuggest;
    private final FoodSuggestService foodSuggest;
    private final NutritionService nutritionService;
    private final DataLabService dataLab;
    private final BriefService briefService;
    private final AiKeyService aiKeyService;

    /** Whether in-app AI is available to this user — lets the UI show a setup hint instead of erroring. */
    @GetMapping("/status")
    public ApiResponse<Map<String, Boolean>> status() {
        return ApiResponse.ok(Map.of("enabled", englishCoach.isEnabled()));
    }

    /** The current user's AI-key status (has own key / masked / available / using shared). */
    @GetMapping("/key")
    public ApiResponse<AiKeyStatus> keyStatus() {
        return ApiResponse.ok(aiKeyService.status());
    }

    /** Save the current user's own AI provider + model + key (verified with a live call). */
    @PutMapping("/key")
    public ApiResponse<Void> saveKey(@RequestBody AiKeyRequest request) {
        aiKeyService.save(request);
        return ApiResponse.ok();
    }

    /** The provider/model catalog for the settings picker. */
    @GetMapping("/providers")
    public ApiResponse<java.util.List<AiCatalog.ProviderInfo>> providers() {
        return ApiResponse.ok(AiCatalog.PROVIDERS);
    }

    /** Remove the current user's own Gemini API key. */
    @DeleteMapping("/key")
    public ApiResponse<Void> deleteKey() {
        aiKeyService.delete();
        return ApiResponse.ok();
    }

    @PostMapping("/datalab/analyze")
    public ApiResponse<DataInsightReply> dataLabAnalyze(@Valid @RequestBody DataInsightRequest request) {
        return ApiResponse.ok(dataLab.analyze(request.profile()));
    }

    /** AI-generated daily brief for the home command center (from the user's dashboard data). */
    @GetMapping("/brief")
    public ApiResponse<com.lifedashboard.ai.dto.BriefReply> brief() {
        return ApiResponse.ok(briefService.generate());
    }

    @PostMapping("/english/chat")
    public ApiResponse<ChatReply> englishChat(@Valid @RequestBody ChatRequest request) {
        return ApiResponse.ok(englishCoach.chat(request));
    }

    @PostMapping("/english/correct")
    public ApiResponse<CorrectionReply> englishCorrect(@Valid @RequestBody ChatRequest request) {
        return ApiResponse.ok(englishCoach.correct(request.message()));
    }

    /** Translate a phrase into a chosen travel language (for the /travel module). */
    @PostMapping("/phrase/translate")
    public ApiResponse<PhraseReply> phraseTranslate(@Valid @RequestBody PhraseTranslateRequest request) {
        return ApiResponse.ok(phraseCoach.translate(request.message(), request.lang()));
    }

    /** Read a receipt photo into expense fields (for the travel wallet). */
    @PostMapping("/receipt")
    public ApiResponse<ReceiptReply> receipt(@Valid @RequestBody ReceiptRequest request) {
        return ApiResponse.ok(receiptService.scan(request));
    }

    /** Suggest sightseeing spots for a destination (for the itinerary). */
    @PostMapping("/spots")
    public ApiResponse<SpotReply> spots(@Valid @RequestBody SpotRequest request) {
        return ApiResponse.ok(spotSuggest.suggest(request.place(), request.days()));
    }

    /** Suggest must-try local dishes for a destination (for the food page). */
    @PostMapping("/food")
    public ApiResponse<FoodReply> food(@Valid @RequestBody FoodRequest request) {
        return ApiResponse.ok(foodSuggest.suggest(request.place()));
    }

    /** Estimate the nutrition of one logged meal/exercise (text and/or photo) — health module. */
    @PostMapping("/nutrition")
    public ApiResponse<NutritionEntryReply> nutrition(@RequestBody NutritionRequest request) {
        return ApiResponse.ok(nutritionService.analyze(request));
    }

    /** Give a daily balanced-nutrition verdict from the day's totals — health module. */
    @PostMapping("/nutrition/review")
    public ApiResponse<NutritionReviewReply> nutritionReview(@RequestBody NutritionReviewRequest request) {
        return ApiResponse.ok(nutritionService.review(request));
    }
}
