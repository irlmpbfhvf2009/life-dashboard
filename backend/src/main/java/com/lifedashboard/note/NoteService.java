package com.lifedashboard.note;

import com.lifedashboard.common.exception.ResourceNotFoundException;
import com.lifedashboard.note.dto.CreateNoteRequest;
import com.lifedashboard.note.dto.NoteDto;
import com.lifedashboard.note.dto.UpdateNoteRequest;
import com.lifedashboard.security.CurrentUserService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class NoteService {

    private final NoteRepository noteRepository;
    private final CurrentUserService currentUserService;

    @Transactional(readOnly = true)
    public List<NoteDto> list() {
        Long userId = currentUserService.getCurrentUserId();
        return noteRepository.findByUserIdOrderByUpdatedAtDesc(userId).stream()
                .map(NoteDto::from).toList();
    }

    @Transactional
    public NoteDto create(CreateNoteRequest request) {
        Long userId = currentUserService.getCurrentUserId();
        Note note = Note.builder()
                .userId(userId)
                .title(request.title())
                .content(request.content())
                .build();
        return NoteDto.from(noteRepository.save(note));
    }

    @Transactional
    public NoteDto update(Long id, UpdateNoteRequest request) {
        Note note = getOwned(id);
        if (request.title() != null) note.setTitle(request.title());
        if (request.content() != null) note.setContent(request.content());
        return NoteDto.from(noteRepository.save(note));
    }

    @Transactional
    public void delete(Long id) {
        noteRepository.delete(getOwned(id));
    }

    private Note getOwned(Long id) {
        Long userId = currentUserService.getCurrentUserId();
        return noteRepository.findByIdAndUserId(id, userId)
                .orElseThrow(() -> new ResourceNotFoundException("Note not found: " + id));
    }
}
