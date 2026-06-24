package com.lifedashboard.ai;

import com.lifedashboard.ai.dto.ChatReply;
import com.lifedashboard.ai.dto.ChatRequest;
import com.lifedashboard.ai.dto.CorrectionReply;
import com.lifedashboard.ai.dto.DataInsightReply;
import com.lifedashboard.ai.dto.DataInsightRequest;
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
    private final DataLabService dataLab;

    /** Whether in-app AI is configured — lets the UI show a setup hint instead of erroring. */
    @GetMapping("/status")
    public ApiResponse<Map<String, Boolean>> status() {
        return ApiResponse.ok(Map.of("enabled", englishCoach.isEnabled()));
    }

    @PostMapping("/datalab/analyze")
    public ApiResponse<DataInsightReply> dataLabAnalyze(@Valid @RequestBody DataInsightRequest request) {
        return ApiResponse.ok(dataLab.analyze(request.profile()));
    }

    @PostMapping("/english/chat")
    public ApiResponse<ChatReply> englishChat(@Valid @RequestBody ChatRequest request) {
        return ApiResponse.ok(englishCoach.chat(request));
    }

    @PostMapping("/english/correct")
    public ApiResponse<CorrectionReply> englishCorrect(@Valid @RequestBody ChatRequest request) {
        return ApiResponse.ok(englishCoach.correct(request.message()));
    }
}
