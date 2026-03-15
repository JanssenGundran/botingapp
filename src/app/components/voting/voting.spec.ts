import { ComponentFixture, TestBed } from '@angular/core/testing';

import { VotingComponent } from './voting';

describe('Voting', () => {
  let component: VotingComponent;
  let fixture: ComponentFixture<VotingComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [VotingComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(VotingComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
