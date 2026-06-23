package com.lifedashboard.note;

import com.lifedashboard.common.ApiResponse;
import com.lifedashboard.note.dto.CreateNoteRequest;
import com.lifedashboard.note.dto.NoteDto;
import com.lifedashboard.note.dto.UpdateNoteRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/notes")
@RequiredArgsConstructor
public class NoteController {

    private final NoteService noteService;

    @GetMapping
    public ApiResponse<List<NoteDto>> list() {
        return ApiResponse.ok(noteService.list());
    }

    @PostMapping
    public ApiResponse<NoteDto> create(@Valid @RequestBody CreateNoteRequest request) {
        return ApiResponse.ok(noteService.create(request));
    }

    @PatchMapping("/{id}")
    public ApiResponse<NoteDto> update(@PathVariable Long id,
                                       @Valid @RequestBody UpdateNoteRequest request) {
        return ApiResponse.ok(noteService.update(id, request));
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable Long id) {
        noteService.delete(id);
        return ApiResponse.ok();
    }
}
