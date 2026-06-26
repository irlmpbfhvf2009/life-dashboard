package com.lifedashboard.ai;

import com.lifedashboard.ai.dto.ChatReply;
import com.lifedashboard.ai.dto.ChatRequest;
import com.lifedashboard.ai.dto.CorrectionReply;
import com.lifedashboard.ai.dto.DataInsightReply;
import com.lifedashboard.ai.dto.DataInsightRequest;
import com.lifedashboard.ai.dto.FoodReply;
import com.lifedashboard.ai.dto.FoodRequest;
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
    private final DataLabService dataLab;
    private final BriefService briefService;

    /** Whether in-app AI is configured — lets the UI show a setup hint instead of erroring. */
    @GetMapping("/status")
    public ApiResponse<Map<String, Boolean>> status() {
        return ApiResponse.ok(Map.of("enabled", englishCoach.isEnabled()));
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
}
