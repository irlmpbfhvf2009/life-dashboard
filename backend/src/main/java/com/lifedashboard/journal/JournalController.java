package com.lifedashboard.journal;

import com.lifedashboard.common.ApiResponse;
import com.lifedashboard.journal.dto.CreateJournalRequest;
import com.lifedashboard.journal.dto.JournalDto;
import com.lifedashboard.journal.dto.UpdateJournalRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/journals")
@RequiredArgsConstructor
public class JournalController {

    private final JournalService journalService;

    @GetMapping
    public ApiResponse<List<JournalDto>> list() {
        return ApiResponse.ok(journalService.list());
    }

    @PostMapping
    public ApiResponse<JournalDto> create(@Valid @RequestBody CreateJournalRequest request) {
        return ApiResponse.ok(journalService.create(request));
    }

    @PatchMapping("/{id}")
    public ApiResponse<JournalDto> update(@PathVariable Long id,
                                          @Valid @RequestBody UpdateJournalRequest request) {
        return ApiResponse.ok(journalService.update(id, request));
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable Long id) {
        journalService.delete(id);
        return ApiResponse.ok();
    }
}
